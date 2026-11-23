import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

class ProviderError extends Error {
  constructor(public status: number, public operation: string) { super("PROVIDER_HTTP_" + status + "_" + operation); }
}

async function providerGet(path: string) {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) throw new Error("MISSING_PROVIDER_TOKEN");
  const res = await fetch("https://api.mercadopago.com" + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new ProviderError(res.status, path.startsWith("/preapproval/") ? "subscription" : "invoice_search");
  return await res.json();
}

type Candidate = {
  id: string; organization_id: string; provider_subscription_id: string;
  status: string; provider_status: string | null; current_period_end: string | null;
  current_period_start: string | null; cancel_at_period_end: boolean;
};

function dateMs(s: unknown): number {
  if (typeof s !== "string") return NaN;
  return new Date(s).getTime();
}

async function reconcile(row: Candidate) {
  const providerId = encodeURIComponent(row.provider_subscription_id);
  const subscription = await providerGet("/preapproval/" + providerId);
  if (String(subscription.id || "") !== row.provider_subscription_id) throw new Error("SUBSCRIPTION_ID_MISMATCH");
  // A fatura está vinculada à assinatura. NUNCA criar pagamentos por esta função.
  const search = await providerGet("/authorized_payments/search?preapproval_id=" + providerId + "&limit=20");
  let recorded = 0;
  let approved = 0;
  let duplicate = 0;
  const invoices = Array.isArray(search.results) ? search.results : [];
  for (const invoice of invoices) {
    if (String(invoice.preapproval_id || "") !== row.provider_subscription_id) continue;
    if (String(invoice.payment?.status || "").toLowerCase() !== "approved") continue;
    if (!invoice.payment?.id || !invoice.id || !Number.isFinite(Number(invoice.transaction_amount))) continue;
    if (String(invoice.currency_id || "BRL") !== "BRL") continue;
    const paymentId = String(invoice.payment.id);
    const paidAt = invoice.debit_date || invoice.last_modified || invoice.date_created;
    if (!Number.isFinite(dateMs(paidAt))) continue;
    const amountCents = Math.round(Number(invoice.transaction_amount) * 100);
    if (amountCents <= 0) continue;
    approved++;
    // A chave única provider_payment_id impede que uma cobrança seja contabilizada duas vezes.
    const { error } = await admin.from("billing_payments").insert({
      organization_id: row.organization_id,
      subscription_id: row.id,
      provider_payment_id: paymentId,
      status: "approved",
      amount_cents: amountCents,
      currency: "BRL",
      paid_at: paidAt,
      period_start: row.current_period_start,
      period_end: row.current_period_end,
      provider_payload: {
        authorized_payment_id: String(invoice.id),
        origin: "automatic_reconciliation",
        payment_status: "approved",
      },
    });
    if (error) {
      if (error.code === "23505") { duplicate++; continue; }
      throw new Error("PAYMENT_WRITE_FAILED");
    }
    recorded++;
  }

  // Não inferir vencimento nem avançar mês somando datas.
  // Usa exclusivamente a data informada pelo provedor e nunca reativa contratos cancelados.
  const nextDebit = subscription.next_debit_date;
  const nextMs = dateMs(nextDebit);
  const currentMs = dateMs(row.current_period_end);
  if (approved > 0 && !row.cancel_at_period_end &&
      !["canceled", "cancelled"].includes(row.status) &&
      Number.isFinite(nextMs) && (!Number.isFinite(currentMs) || nextMs > currentMs)) {
    const patch = {
      status: "active",
      provider_status: String(subscription.status || "payment_approved"),
      current_period_start: Number.isFinite(currentMs) ? row.current_period_end : null,
      current_period_end: new Date(nextMs).toISOString(),
      grace_period_ends_at: null,
    };
    // Protege contra mudanças simultâneas de período e alterações de assinatura.
    let update = admin.from("screen_subscriptions").update(patch)
      .eq("id", row.id).eq("provider_subscription_id", row.provider_subscription_id)
      .eq("cancel_at_period_end", false);
    update = row.current_period_end
      ? update.eq("current_period_end", row.current_period_end)
      : update.is("current_period_end", null);
    const { error } = await update;
    if (error) throw new Error("SUBSCRIPTION_WRITE_FAILED");
  }
  return { recorded, approved, duplicate };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  const token = req.headers.get("x-screen-reconcile-token") || "";
  if (token.length < 24) return response({ error: "ACCESS_DENIED" }, 401);
  const { data: valid, error: authError } = await admin.rpc("screen_reconcile_token_valid", { p_token: token });
  if (authError || valid !== true) return response({ error: "ACCESS_DENIED" }, 401);

  const { data, error } = await admin.from("screen_subscriptions")
    .select("id,organization_id,provider_subscription_id,status,provider_status,current_period_end,current_period_start,cancel_at_period_end")
    .eq("provider_plan_id", "screen-day-v1")
    .eq("billing_exempt", false)
    .not("provider_subscription_id", "is", null)
    .order("current_period_end", { ascending: true })
    .limit(25);
  if (error) return response({ error: "DATABASE_READ_FAILED" }, 500);

  const now = Date.now();
  const candidates = ((data || []) as Candidate[])
    .filter((row) => !["canceled", "cancelled"].includes(row.status))
    .filter((row) => row.status === "past_due" || row.provider_status === "pending" ||
      (Number.isFinite(dateMs(row.current_period_end)) && dateMs(row.current_period_end) < now + 2 * 86400000))
    .slice(0, 3);

  let updated = 0, matched = 0, failed = 0;
  for (const row of candidates) {
    try {
      const result = await reconcile(row);
      updated += result.recorded;
      matched += result.approved;
    } catch (e) {
      failed++;
      if (e instanceof ProviderError && e.status === 429) {
        // Sem retries imediatos: preservar cota do provedor para o checkout normal.
        console.warn("Billing reconciliation paused: rate limited");
        return response({ checked: matched, newlyRecorded: updated, deferred: true, reason: "RATE_LIMIT" }, 429);
      }
      console.error("Billing reconciliation failed:", e instanceof Error ? e.message : "UNKNOWN");
    }
  }
  return response({ candidates: candidates.length, approvedMatches: matched, newlyRecorded: updated, failed });
});

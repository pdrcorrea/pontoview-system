import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "https://telas.pontoview.com.br",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

async function mpGet(path: string) {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) throw new Error("MP_NOT_CONFIGURED");
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 429) throw new Error("PROVIDER_RATE_LIMIT");
  if (!response.ok) throw new Error(`MP_HTTP_${response.status}`);
  return response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return respond({ error: "AUTH_REQUIRED" }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return respond({ error: "INVALID_SESSION" }, 401);

  const input = await request.json().catch(() => ({}));
  const organizationId = typeof input.organizationId === "string" ? input.organizationId : "";
  if (!/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(organizationId))
    return respond({ error: "INVALID_ORGANIZATION" }, 400);

  const { data: membership, error: membershipError } = await admin
    .from("organization_users")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (membershipError || membership?.role !== "owner")
    return respond({ error: "ACCESS_DENIED" }, 403);

  const { data: subscription, error: subscriptionError } = await admin
    .from("screen_subscriptions")
    .select("provider_subscription_id,status,provider_status,current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (subscriptionError || !subscription?.provider_subscription_id)
    return respond({ error: "SUBSCRIPTION_NOT_FOUND" }, 404);

  try {
    const providerId = encodeURIComponent(subscription.provider_subscription_id);
    // Sequential calls reduce burst traffic against the provider's shared rate limit.
    const remote = await mpGet(`/preapproval/${providerId}`);
    const invoices = await mpGet(`/authorized_payments/search?preapproval_id=${providerId}&limit=50`);
    const matches = (Array.isArray(invoices.results) ? invoices.results : [])
      .filter((invoice: Record<string, unknown>) =>
        String(invoice.preapproval_id || "") === subscription.provider_subscription_id)
      .map((invoice: any) => ({
        authorizedPaymentId: String(invoice.id || ""),
        paymentId: invoice.payment?.id ? String(invoice.payment.id) : null,
        paymentStatus: String(invoice.payment?.status || ""),
        invoiceStatus: String(invoice.status || ""),
        amount: Number(invoice.transaction_amount || 0),
        debitDate: invoice.debit_date || null,
      }));

    return respond({
      local: {
        status: subscription.status,
        providerStatus: subscription.provider_status,
        periodEnd: subscription.current_period_end,
      },
      remote: {
        status: remote.status || null,
        nextDebitDate: remote.next_debit_date || null,
        lastChargedDate: remote.last_charged_date || null,
        lastChargedAmount: remote.last_charged_amount ?? null,
      },
      invoices: matches,
      truncated: Number(invoices.paging?.total || matches.length) > matches.length,
      readOnly: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROVIDER_RATE_LIMIT") {
      return respond({ error: "PROVIDER_RATE_LIMIT" }, 429);
    }
    console.error("screens payment diagnostic failed", error instanceof Error ? error.message : "unknown");
    return respond({ error: "PROVIDER_LOOKUP_FAILED" }, 502);
  }
});

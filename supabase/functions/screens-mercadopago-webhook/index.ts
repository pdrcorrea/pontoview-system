import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply } from "../_shared/common.ts";

const API = "https://api.mercadopago.com";
const encoder = new TextEncoder();

function signature(value: string | null) {
  let ts = "";
  let v1 = "";
  for (const part of (value || "").split(",")) {
    const [k, v] = part.split("=");
    if (k?.trim() === "ts") ts = v?.trim();
    if (k?.trim() === "v1") v1 = v?.trim();
  }
  return { ts, v1 };
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(req: Request) {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return false;
  const url = new URL(req.url);
  const { ts, v1 } = signature(req.headers.get("x-signature"));
  const requestId = req.headers.get("x-request-id") || "";
  const id = (url.searchParams.get("data.id") || "").toLowerCase();
  if (!ts || !v1) return false;
  const manifest = `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return equal(
    hex(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest))),
    v1,
  );
}

async function mp(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN") || ""}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "X-Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago error", response.status, json);
    throw new HttpError(502, "MERCADO_PAGO_LOOKUP_FAILED");
  }
  return json;
}

function addMonth(value: string) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

type BillingUsage = {
  unitPriceCents: number;
  activeScreens: number;
  trialActive: boolean;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  screenDaysAccrued: number;
  screenDaysProjected: number;
  accruedAmountCents: number;
  projectedAmountCents: number;
};

async function usageFor(organizationId: string) {
  const { data, error } = await admin.rpc("screen_billing_summary", {
    p_organization_id: organizationId,
  });
  if (error || !data) {
    console.error("Billing summary failed", error);
    throw new HttpError(500, "BILLING_SUMMARY_FAILED");
  }
  return data as BillingUsage;
}

async function findSubscription(providerId: string, externalReference: string) {
  const fields = "id,organization_id,status,provider_subscription_id,provider_status,provider_plan_id,trial_ends_at,current_period_start,current_period_end,grace_period_ends_at,cancel_at_period_end,billing_started_at,projected_amount_cents,last_synced_amount_cents";
  const byProvider = await admin
    .from("screen_subscriptions")
    .select(fields)
    .eq("provider_subscription_id", providerId)
    .maybeSingle();
  if (byProvider.data) return { ...byProvider.data, stale: false };

  const organizationId = externalReference.startsWith("screens:")
    ? externalReference.slice(8)
    : "";
  if (!organizationId) return null;

  const byOrg = await admin
    .from("screen_subscriptions")
    .select(fields)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!byOrg.data) return null;

  const stale = Boolean(
    byOrg.data.provider_subscription_id &&
      byOrg.data.provider_subscription_id !== providerId,
  );
  return { ...byOrg.data, stale };
}

async function syncPreapproval(data: any) {
  const providerId = String(data.id || "");
  const externalReference = String(data.external_reference || "");
  const subscription = await findSubscription(providerId, externalReference);
  if (!subscription)
    throw new HttpError(404, "SUBSCRIPTION_LINK_NOT_FOUND");
  if (subscription.stale) {
    return {
      organizationId: subscription.organization_id,
      providerId,
      stale: true,
      status: subscription.status,
    };
  }

  const raw = String(data.status || "").toLowerCase();
  const now = new Date();
  const trialEnded = subscription.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime() <= now.getTime()
    : true;
  const update: Record<string, unknown> = {
    provider: "mercadopago",
    provider_subscription_id: providerId,
    provider_status: raw,
    payer_email: data.payer_email || null,
  };

  if (raw === "cancelled" || raw === "canceled") {
    update.status = "canceled";
    update.cancel_at_period_end = false;
    update.canceled_at = now.toISOString();
  } else if (raw === "authorized") {
    if (trialEnded) update.status = "active";
    update.grace_period_ends_at = null;
    update.canceled_at = null;
  } else if (raw === "paused") {
    const usage = await usageFor(subscription.organization_id);
    if (usage.projectedAmountCents > 0) update.status = "suspended";
  }

  const result = await admin
    .from("screen_subscriptions")
    .update(update)
    .eq("id", subscription.id);
  if (result.error) throw result.error;

  return {
    organizationId: subscription.organization_id,
    providerId,
    stale: false,
    status: String(update.status || subscription.status),
  };
}

async function setNextProviderAmount(
  providerId: string,
  subscriptionId: string,
  amountCents: number,
) {
  if (amountCents <= 0) {
    const updated = await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
      status: "paused",
    });
    await admin
      .from("screen_subscriptions")
      .update({
        projected_amount_cents: 0,
        last_synced_amount_cents: 0,
        provider_status: String(updated.status || "paused"),
      })
      .eq("id", subscriptionId);
    return;
  }

  const updated = await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
    auto_recurring: {
      transaction_amount: amountCents / 100,
      currency_id: "BRL",
    },
  });
  await admin
    .from("screen_subscriptions")
    .update({
      projected_amount_cents: amountCents,
      last_synced_amount_cents: amountCents,
      provider_status: String(updated.status || "authorized"),
    })
    .eq("id", subscriptionId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET")
    return reply({ ok: true, service: "screens-mercadopago-webhook" });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    if (!(await verify(req))) return reply({ error: "INVALID_SIGNATURE" }, 401);

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || body.type || "");
    const id = String(url.searchParams.get("data.id") || body.data?.id || "");
    if (!id) return reply({ ok: true, ignored: "missing_id" });

    const isMercadoPagoSimulator =
      id === "123456" &&
      String(body.id || "") === "123456" &&
      Number(body.version || 0) === 8;
    if (isMercadoPagoSimulator)
      return reply({ ok: true, test: true, received: { type, id } });

    if (type === "subscription_preapproval") {
      const preapproval = await mp(`/preapproval/${encodeURIComponent(id)}`);
      const result = await syncPreapproval(preapproval);
      return result.stale
        ? reply({ ok: true, ignored: "stale_preapproval" })
        : reply({ ok: true, result });
    }

    if (type === "subscription_authorized_payment") {
      const invoice = await mp(`/authorized_payments/${encodeURIComponent(id)}`);
      const preapproval = await mp(
        `/preapproval/${encodeURIComponent(invoice.preapproval_id)}`,
      );
      const synced = await syncPreapproval(preapproval);
      if (synced.stale)
        return reply({ ok: true, ignored: "stale_authorized_payment" });

      const approved = String(invoice.payment?.status || "").toLowerCase() === "approved";
      const paidAt =
        invoice.debit_date ||
        invoice.last_modified ||
        invoice.date_created ||
        new Date().toISOString();
      const amountCents = Math.round(
        Number(invoice.transaction_amount || invoice.payment?.transaction_amount || 0) * 100,
      );

      const { data: subscription, error: subscriptionError } = await admin
        .from("screen_subscriptions")
        .select("id,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,provider_subscription_id")
        .eq("organization_id", synced.organizationId)
        .single();
      if (subscriptionError || !subscription)
        throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND");

      if (approved) {
        const closedUsage = await usageFor(synced.organizationId);
        const periodStart = subscription.current_period_start || closedUsage.periodStart;
        const periodEnd = subscription.current_period_end || closedUsage.periodEnd;

        await admin.from("billing_payments").upsert(
          {
            organization_id: synced.organizationId,
            subscription_id: subscription.id,
            provider_payment_id: String(invoice.payment?.id || id),
            status: "approved",
            amount_cents: amountCents,
            currency: "BRL",
            paid_at: paidAt,
            period_start: periodStart,
            period_end: periodEnd,
            provider_payload: {
              authorized_payment_id: id,
              billing_model: "screen_day",
              screen_days: closedUsage.screenDaysProjected,
              unit_price_cents: closedUsage.unitPriceCents,
            },
          },
          { onConflict: "provider_payment_id" },
        );

        if (subscription.cancel_at_period_end) {
          await mp(
            `/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`,
            "PUT",
            { status: "canceled" },
          );
          await admin
            .from("screen_subscriptions")
            .update({
              status: "canceled",
              provider_status: "canceled",
              cancel_at_period_end: false,
              canceled_at: new Date().toISOString(),
              grace_period_ends_at: null,
            })
            .eq("id", subscription.id);
          return reply({ ok: true, approved: true, canceled: true });
        }

        const nextPeriodStart = periodEnd;
        const nextPeriodEnd = addMonth(periodEnd);
        await admin
          .from("screen_subscriptions")
          .update({
            status: "active",
            current_period_start: nextPeriodStart,
            current_period_end: nextPeriodEnd,
            grace_period_ends_at: null,
            provider_status: "payment_approved",
            projected_amount_cents: 0,
            last_synced_amount_cents: 0,
          })
          .eq("id", subscription.id);

        const nextUsage = await usageFor(synced.organizationId);
        await setNextProviderAmount(
          String(subscription.provider_subscription_id),
          subscription.id,
          Number(nextUsage.projectedAmountCents || 0),
        );
      } else {
        const trialValid =
          subscription.status === "trial" &&
          subscription.trial_ends_at &&
          new Date(subscription.trial_ends_at).getTime() > Date.now();
        await admin
          .from("screen_subscriptions")
          .update({
            status: trialValid ? "trial" : "past_due",
            grace_period_ends_at: trialValid
              ? null
              : new Date(Date.now() + 7 * 86400000).toISOString(),
            provider_status: String(invoice.payment?.status || "payment_not_approved"),
          })
          .eq("id", subscription.id);
      }

      return reply({ ok: true, approved });
    }

    return reply({ ok: true, ignored: type || "unknown" });
  } catch (error) {
    return handleError(error);
  }
});

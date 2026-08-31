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

async function mp(path: string) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN") || ""}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, "MERCADO_PAGO_LOOKUP_FAILED");
  return json;
}

function addMonth(value: string) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

async function findSubscription(providerId: string, externalReference: string) {
  const byProvider = await admin
    .from("screen_subscriptions")
    .select("id,organization_id,status,plan_id,pending_plan_id,provider_subscription_id,trial_ends_at,current_period_end")
    .eq("provider_subscription_id", providerId)
    .maybeSingle();
  if (byProvider.data) return { ...byProvider.data, stale: false };

  const organizationId = externalReference.startsWith("screens:")
    ? externalReference.slice(8)
    : "";
  if (!organizationId) return null;

  const byOrg = await admin
    .from("screen_subscriptions")
    .select("id,organization_id,status,plan_id,pending_plan_id,provider_subscription_id,trial_ends_at,current_period_end")
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
  const update: Record<string, unknown> = {
    provider: "mercadopago",
    provider_subscription_id: providerId,
    provider_status: raw,
    payer_email: data.payer_email || null,
  };

  if (raw === "cancelled" || raw === "canceled") {
    update.status = "canceled";
    update.cancel_at_period_end = true;
    update.canceled_at = now.toISOString();
    update.pending_plan_id = null;
    update.pending_plan_requested_at = null;
  } else if (raw === "paused") {
    update.status = "suspended";
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
      const periodEnd = addMonth(paidAt);
      const amountCents = Math.round(
        Number(invoice.transaction_amount || invoice.payment?.transaction_amount || 0) * 100,
      );

      const { data: subscription } = await admin
        .from("screen_subscriptions")
        .select("id,status,plan_id,pending_plan_id,trial_ends_at")
        .eq("organization_id", synced.organizationId)
        .single();

      if (approved && subscription) {
        await admin.from("billing_payments").upsert(
          {
            organization_id: synced.organizationId,
            subscription_id: subscription.id,
            provider_payment_id: String(invoice.payment?.id || id),
            status: "approved",
            amount_cents: amountCents,
            currency: "BRL",
            paid_at: paidAt,
            period_start: paidAt,
            period_end: periodEnd,
            provider_payload: { authorized_payment_id: id },
          },
          { onConflict: "provider_payment_id" },
        );

        let activatePendingPlan = false;
        if (subscription.pending_plan_id) {
          const { data: pendingPlan } = await admin
            .from("plans")
            .select("id,code,price_cents")
            .eq("id", subscription.pending_plan_id)
            .maybeSingle();
          activatePendingPlan = Boolean(
            pendingPlan && Math.abs(Number(pendingPlan.price_cents) - amountCents) <= 1,
          );
        }

        const update: Record<string, unknown> = {
          status: "active",
          current_period_start: paidAt,
          current_period_end: periodEnd,
          grace_period_ends_at: null,
          provider_status: "payment_approved",
        };

        if (activatePendingPlan && subscription.pending_plan_id) {
          update.plan_id = subscription.pending_plan_id;
          update.pending_plan_id = null;
          update.pending_plan_requested_at = null;
        }

        await admin
          .from("screen_subscriptions")
          .update(update)
          .eq("id", subscription.id);
      } else if (subscription) {
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

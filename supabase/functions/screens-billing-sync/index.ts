import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const API = "https://api.mercadopago.com";
const MODEL_VERSION = "screen-day-v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-billing-sync",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

async function mp(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_NOT_CONFIGURED");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago error", response.status, json);
    throw new Error(`MERCADO_PAGO_${response.status}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const suppliedSecret = req.headers.get("x-billing-sync") || "";
    const { data: secretValid, error: secretError } = await admin.rpc(
      "screen_billing_sync_secret_valid",
      { p_secret: suppliedSecret },
    );
    if (secretError || secretValid !== true)
      return reply({ error: "INVALID_SYNC_SECRET" }, 401);

    const body = await req.json().catch(() => ({}));
    const organizationId = String(body.organizationId || "");
    if (!organizationId) return reply({ error: "ORGANIZATION_REQUIRED" }, 400);

    const [{ data: subscription, error: subError }, { data: usage, error: usageError }] = await Promise.all([
      admin
        .from("screen_subscriptions")
        .select("id,status,trial_ends_at,provider_subscription_id,provider_status,provider_plan_id,last_synced_amount_cents")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin.rpc("screen_billing_summary", { p_organization_id: organizationId }),
    ]);

    if (subError || usageError || !subscription || !usage) {
      console.error("Billing sync lookup failed", subError, usageError);
      return reply({ error: "BILLING_LOOKUP_FAILED" }, 404);
    }

    const amountCents = Math.max(0, Number(usage.projectedAmountCents || 0));
    const trialEnded = subscription.trial_ends_at
      ? new Date(subscription.trial_ends_at).getTime() <= Date.now()
      : true;
    const statusPatch: Record<string, unknown> = {
      projected_amount_cents: amountCents,
    };

    const providerId = String(subscription.provider_subscription_id || "");
    const providerStatus = String(subscription.provider_status || "").toLowerCase();
    const currentAmount = Number(subscription.last_synced_amount_cents || 0);
    const managedProvider = subscription.provider_plan_id === MODEL_VERSION;

    if (!providerId || !managedProvider || ["canceled", "cancelled"].includes(providerStatus)) {
      await admin.from("screen_subscriptions").update(statusPatch).eq("id", subscription.id);
      return reply({ ok: true, amountCents, providerSynced: false });
    }

    if (
      trialEnded &&
      subscription.status === "trial" &&
      ["authorized", "payment_approved", "paused"].includes(providerStatus)
    ) {
      statusPatch.status = "active";
    }

    if (amountCents <= 0) {
      if (["authorized", "payment_approved"].includes(providerStatus)) {
        const updated = await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
          status: "paused",
        });
        statusPatch.last_synced_amount_cents = 0;
        statusPatch.provider_status = String(updated.status || "paused");
      }
      await admin.from("screen_subscriptions").update(statusPatch).eq("id", subscription.id);
      return reply({ ok: true, amountCents, providerSynced: true });
    }

    const needsAmountUpdate = amountCents !== currentAmount;
    const needsResume = providerStatus === "paused";
    if (needsAmountUpdate || needsResume) {
      const payload: Record<string, unknown> = {
        auto_recurring: {
          transaction_amount: amountCents / 100,
          currency_id: "BRL",
        },
      };
      if (needsResume) payload.status = "authorized";
      const updated = await mp(
        `/preapproval/${encodeURIComponent(providerId)}`,
        "PUT",
        payload,
      );
      statusPatch.last_synced_amount_cents = amountCents;
      statusPatch.provider_status = String(updated.status || "authorized");
    }

    await admin.from("screen_subscriptions").update(statusPatch).eq("id", subscription.id);
    return reply({
      ok: true,
      amountCents,
      providerSynced: needsAmountUpdate || needsResume,
    });
  } catch (error) {
    console.error(error);
    return reply({ error: "INTERNAL_ERROR" }, 500);
  }
});

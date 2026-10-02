import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const API = "https://api.mercadopago.com";
const CANONICAL_RETURN_URL = "https://telas.pontoview.com.br/financeiro";
const BILLING_MODEL_VERSION = "screen-day-v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
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

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function handleError(error: unknown) {
  console.error(error);
  return error instanceof HttpError
    ? reply({ error: error.message }, error.status)
    : reply({ error: "INTERNAL_ERROR" }, 500);
}

async function requireUser(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "AUTH_REQUIRED");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "INVALID_SESSION");
  return data.user;
}

async function requireOrgRole(
  userId: string,
  organizationId: string,
  roles = ["owner"],
) {
  const { data } = await admin
    .from("organization_users")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !roles.includes(data.role))
    throw new HttpError(403, "ACCESS_DENIED");
  return data.role as string;
}

async function mp(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) throw new HttpError(503, "MERCADO_PAGO_NOT_CONFIGURED");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "X-Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago error", response.status, json);
    throw new HttpError(502, `MERCADO_PAGO_${response.status}`);
  }
  return json;
}

type Usage = {
  billingModel: string;
  unitPriceCents: number;
  activeScreens: number;
  trialEndsAt: string;
  trialActive: boolean;
  trialDaysRemaining: number;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  screenDaysAccrued: number;
  screenDaysProjected: number;
  accruedAmountCents: number;
  projectedAmountCents: number;
};

async function getUsage(organizationId: string) {
  const { data, error } = await admin.rpc("screen_billing_summary", {
    p_organization_id: organizationId,
  });
  if (error || !data) {
    console.error("Billing summary failed", error);
    throw new HttpError(500, "BILLING_SUMMARY_FAILED");
  }
  return data as Usage;
}

async function getSubscription(organizationId: string) {
  const { data, error } = await admin
    .from("screen_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single();
  if (error || !data) {
    console.error("Subscription lookup failed", error);
    throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND");
  }
  return data;
}

async function syncProviderAmount(subscription: any, usage: Usage) {
  const amountCents = Math.max(0, Number(usage.projectedAmountCents || 0));

  await admin
    .from("screen_subscriptions")
    .update({ projected_amount_cents: amountCents })
    .eq("id", subscription.id);

  const providerId = String(subscription.provider_subscription_id || "");
  const providerStatus = String(subscription.provider_status || "").toLowerCase();
  const managedProvider = subscription.provider_plan_id === BILLING_MODEL_VERSION;
  if (
    !providerId ||
    !managedProvider ||
    ["canceled", "cancelled"].includes(providerStatus)
  ) {
    return { amountCents, providerSynced: false };
  }

  const previouslySynced = Number(subscription.last_synced_amount_cents || 0);

  if (amountCents <= 0) {
    if (["authorized", "payment_approved"].includes(providerStatus)) {
      const updated = await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
        status: "paused",
      });
      await admin
        .from("screen_subscriptions")
        .update({
          last_synced_amount_cents: 0,
          provider_status: String(updated.status || "paused"),
        })
        .eq("id", subscription.id);
      return { amountCents, providerSynced: true };
    }
    return { amountCents, providerSynced: false };
  }

  const needsAmountUpdate = previouslySynced !== amountCents;
  const needsResume = providerStatus === "paused";
  if (!needsAmountUpdate && !needsResume) {
    return { amountCents, providerSynced: false };
  }

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
  await admin
    .from("screen_subscriptions")
    .update({
      projected_amount_cents: amountCents,
      last_synced_amount_cents: amountCents,
      provider_status: String(updated.status || providerStatus || "authorized"),
    })
    .eq("id", subscription.id);

  return { amountCents, providerSynced: true };
}

async function summaryForUser(userId: string) {
  const { data: membership, error: membershipError } = await admin
    .from("organization_users")
    .select("organization_id,role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership)
    throw new HttpError(404, "ORGANIZATION_NOT_FOUND");

  const organizationId = membership.organization_id;
  const [
    { data: organization },
    { data: subscription },
    { data: payments },
    usage,
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,display_name,timezone,locale")
      .eq("id", organizationId)
      .single(),
    admin
      .from("screen_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("billing_payments")
      .select("id,provider_payment_id,status,amount_cents,currency,paid_at,period_start,period_end,created_at")
      .eq("organization_id", organizationId)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(24),
    getUsage(organizationId),
  ]);

  if (subscription) {
    try {
      await syncProviderAmount(subscription, usage);
    } catch (error) {
      console.error("Background amount sync from summary failed", error);
    }
  }

  return {
    organization,
    membership,
    subscription: subscription
      ? { ...subscription, projected_amount_cents: usage.projectedAmountCents }
      : null,
    usage,
    payments: payments || [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    if (body.action === "summary") {
      return reply(await summaryForUser(user.id));
    }

    const organizationId = String(body.organizationId || "");
    if (!organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED");

    if (body.action === "sync") {
      await requireOrgRole(user.id, organizationId, ["owner", "admin", "editor"]);
      const [subscription, usage] = await Promise.all([
        getSubscription(organizationId),
        getUsage(organizationId),
      ]);
      const sync = await syncProviderAmount(subscription, usage);
      return reply({ ok: true, usage, sync });
    }

    await requireOrgRole(user.id, organizationId, ["owner"]);
    const [subscription, usage] = await Promise.all([
      getSubscription(organizationId),
      getUsage(organizationId),
    ]);

    if (body.action === "cancel") {
      const providerId = String(subscription.provider_subscription_id || "");

      if (usage.trialActive) {
        if (providerId) {
          await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
            status: "canceled",
          });
        }
        await admin
          .from("screen_subscriptions")
          .update({
            status: "trial",
            cancel_at_period_end: false,
            canceled_at: null,
            provider_status: providerId ? "canceled" : subscription.provider_status,
            provider_plan_id: providerId ? null : subscription.provider_plan_id,
            last_synced_amount_cents: 0,
          })
          .eq("id", subscription.id);
        return reply({ ok: true, scheduled: false, trialContinues: true });
      }

      if (!providerId) {
        await admin
          .from("screen_subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            canceled_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
        return reply({ ok: true, scheduled: false });
      }

      await syncProviderAmount(subscription, usage);
      await admin
        .from("screen_subscriptions")
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
      return reply({ ok: true, scheduled: true, cancelAt: usage.periodEnd });
    }

    if (body.action !== "checkout")
      throw new HttpError(400, "INVALID_ACTION");

    if (usage.projectedAmountCents <= 0 || usage.activeScreens <= 0)
      throw new HttpError(409, "CONNECT_A_SCREEN_FIRST");

    const returnUrl = CANONICAL_RETURN_URL;
    const providerId = String(subscription.provider_subscription_id || "");
    const providerStatus = String(subscription.provider_status || "").toLowerCase();

    if (
      providerId &&
      subscription.provider_plan_id === BILLING_MODEL_VERSION &&
      providerStatus === "pending"
    ) {
      await syncProviderAmount(subscription, usage);
      const existing = await mp(`/preapproval/${encodeURIComponent(providerId)}`);
      if (existing.init_point) return reply({ checkoutUrl: existing.init_point });
    }

    if (
      providerId &&
      ["authorized", "payment_approved", "paused"].includes(providerStatus)
    ) {
      await syncProviderAmount(subscription, usage);
      return reply({ checkoutUrl: `${returnUrl}?billing=active` });
    }

    if (providerId && providerStatus === "pending") {
      try {
        await mp(`/preapproval/${encodeURIComponent(providerId)}`, "PUT", {
          status: "canceled",
        });
      } catch (error) {
        console.error("Could not cancel legacy pending preapproval", error);
      }
    }

    const payload = {
      reason: "PontoView Telas - telas vinculadas",
      external_reference: `screens:${organizationId}`,
      payer_email: user.email,
      back_url: returnUrl,
      notification_url: `${SUPABASE_URL}/functions/v1/screens-mercadopago-webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        start_date: usage.periodEnd,
        transaction_amount: usage.projectedAmountCents / 100,
        currency_id: "BRL",
      },
      status: "pending",
    };

    const created = await mp("/preapproval", "POST", payload);
    if (!created.id || !created.init_point)
      throw new HttpError(502, "CHECKOUT_CREATION_FAILED");

    await admin
      .from("screen_subscriptions")
      .update({
        provider: "mercadopago",
        provider_subscription_id: String(created.id),
        provider_plan_id: BILLING_MODEL_VERSION,
        provider_status: String(created.status || "pending"),
        payer_email: user.email,
        billing_started_at: usage.periodStart,
        current_period_start: usage.periodStart,
        current_period_end: usage.periodEnd,
        projected_amount_cents: usage.projectedAmountCents,
        last_synced_amount_cents: usage.projectedAmountCents,
        cancel_at_period_end: false,
        canceled_at: null,
      })
      .eq("id", subscription.id);

    return reply({ checkoutUrl: created.init_point });
  } catch (error) {
    return handleError(error);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const API = "https://api.mercadopago.com";
const CANONICAL_RETURN_URL = "https://telas.pontoview.com.br/financeiro";
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
}

async function mp(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) throw new HttpError(503, "MERCADO_PAGO_NOT_CONFIGURED");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(method === "POST"
        ? { "X-Idempotency-Key": crypto.randomUUID() }
        : {}),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    if (body.action === "summary") {
      const { data: membership, error: membershipError } = await admin
        .from("organization_users")
        .select("organization_id,role")
        .eq("user_id", user.id)
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
        { data: plans },
      ] = await Promise.all([
        admin.from("organizations").select("*").eq("id", organizationId).single(),
        admin
          .from("screen_subscriptions")
          .select("*,plans(*),pending_plan:plans!screen_subscriptions_pending_plan_id_fkey(*)")
          .eq("organization_id", organizationId)
          .maybeSingle(),
        admin
          .from("billing_payments")
          .select(
            "id,provider_payment_id,status,amount_cents,currency,paid_at,period_start,period_end,created_at",
          )
          .eq("organization_id", organizationId)
          .order("paid_at", { ascending: false, nullsFirst: false })
          .limit(24),
        admin
          .from("plans")
          .select(
            "id,code,name,description,price_cents,list_price_cents,promotion_percent,currency,billing_period,screen_limit,user_limit,trial_days,features,sort_order",
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      return reply({
        organization,
        membership,
        subscription,
        payments: payments || [],
        plans: plans || [],
      });
    }

    const organizationId = String(body.organizationId || "");
    if (!organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED");
    await requireOrgRole(user.id, organizationId, ["owner"]);

    const { data: subscription, error: subError } = await admin
      .from("screen_subscriptions")
      .select("*,plans(*)")
      .eq("organization_id", organizationId)
      .single();
    if (subError || !subscription)
      throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND");

    if (body.action === "cancel") {
      if (!subscription.provider_subscription_id)
        throw new HttpError(409, "NO_PROVIDER_SUBSCRIPTION");
      await mp(
        `/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`,
        "PUT",
        { status: "cancelled" },
      );
      await admin
        .from("screen_subscriptions")
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          provider_status: "cancelled",
          pending_plan_id: null,
          pending_plan_requested_at: null,
        })
        .eq("id", subscription.id);
      return reply({ ok: true });
    }

    if (body.action !== "checkout")
      throw new HttpError(400, "INVALID_ACTION");

    const { data: plan } = await admin
      .from("plans")
      .select("*")
      .eq("code", String(body.planCode || ""))
      .eq("is_active", true)
      .single();
    if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND");

    const returnUrl = CANONICAL_RETURN_URL;
    const requestedAt = new Date().toISOString();

    if (
      subscription.provider_subscription_id &&
      subscription.status === "active"
    ) {
      await mp(
        `/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`,
        "PUT",
        {
          auto_recurring: {
            transaction_amount: plan.price_cents / 100,
            currency_id: "BRL",
          },
        },
      );

      await admin
        .from("screen_subscriptions")
        .update({
          pending_plan_id: plan.id,
          pending_plan_requested_at: requestedAt,
          provider_plan_id: plan.code,
        })
        .eq("id", subscription.id);

      return reply({ checkoutUrl: `${returnUrl}?plan=pending` });
    }

    const payload = {
      reason: `PontoView — ${plan.name}`,
      external_reference: `screens:${organizationId}`,
      payer_email: user.email,
      back_url: returnUrl,
      notification_url: `${SUPABASE_URL}/functions/v1/screens-mercadopago-webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price_cents / 100,
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
        pending_plan_id: plan.id,
        pending_plan_requested_at: requestedAt,
        provider: "mercadopago",
        provider_subscription_id: String(created.id),
        provider_plan_id: plan.code,
        provider_status: String(created.status || "pending"),
        payer_email: user.email,
      })
      .eq("id", subscription.id);

    return reply({ checkoutUrl: created.init_point });
  } catch (error) {
    return handleError(error);
  }
});

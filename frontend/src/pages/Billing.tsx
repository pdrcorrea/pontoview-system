import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  FormMessage,
  PageHead,
  formatDate,
} from "../components/ui";
import { invokeFunction, supabase } from "../lib/supabase";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  list_price_cents: number | null;
  promotion_percent: number;
  screen_limit: number;
  features: Record<string, boolean>;
};

type Subscription = {
  id: string;
  status: string;
  plan_id: string;
  pending_plan_id: string | null;
  pending_plan_requested_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  plans: Plan | null;
  pending_plan: Plan | null;
};

type Payment = {
  id: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
};

export function BillingPage() {
  const { organization, role } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [p, s, h] = await Promise.all([
      supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("screen_subscriptions")
        .select("*,plans:plans!screen_subscriptions_plan_id_fkey(*),pending_plan:plans!screen_subscriptions_pending_plan_id_fkey(*)")
        .eq("organization_id", organization.id)
        .maybeSingle(),
      supabase
        .from("billing_payments")
        .select("id,status,amount_cents,paid_at,created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
    ]);
    if (p.data) setPlans(p.data as Plan[]);
    if (s.error) setError(s.error.message);
    else if (s.data) setSubscription(s.data as unknown as Subscription);
    if (h.data) setPayments(h.data as Payment[]);
  }, [organization]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkout = async (plan: Plan) => {
    if (!organization) return;
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{ checkoutUrl: string }>(
        "screens-billing",
        {
          action: "checkout",
          organizationId: organization.id,
          planCode: plan.code,
        },
      );
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o Mercado Pago.",
      );
    }
  };

  const cancel = async () => {
    if (!organization || !confirm("Cancelar assinatura?")) return;
    setBusy(true);
    try {
      await invokeFunction("screens-billing", {
        action: "cancel",
        organizationId: organization.id,
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível cancelar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const plan = subscription?.plans;
  const pendingPlan = subscription?.pending_plan;
  const next = subscription?.current_period_end || subscription?.trial_ends_at;

  return (
    <>
      <PageHead eyebrow="Assinatura" title="Financeiro" text="Plano e pagamentos." />
      <FormMessage error={error} />

      {subscription && plan && (
        <div className="billing-hero panel">
          <div>
            <span className="eyebrow">PLANO ATUAL</span>
            <h2>{plan.name}</h2>
            {plan.promotion_percent > 0 && (
              <span className="promo-badge">LANÇAMENTO · {plan.promotion_percent}% OFF</span>
            )}
            <PlanPrice plan={plan} />
            <small>
              {plan.screen_limit} {plan.screen_limit === 1 ? "tela" : "telas"}
            </small>
            {pendingPlan && pendingPlan.id !== plan.id && (
              <small className="pending-plan-note">
                Alteração pendente: {pendingPlan.name}
              </small>
            )}
          </div>
          <div className="billing-status">
            <span
              className={`status ${["active", "trial"].includes(subscription.status) ? "active" : "offline-status"}`}
            >
              <Check /> {statusName(subscription.status)}
            </span>
            <small>{subscription.status === "trial" ? "Fim do teste" : "Próxima cobrança"}</small>
            <b>{formatDate(next)}</b>
            {role === "owner" && subscription.status === "active" && (
              <AsyncButton
                busy={busy}
                className="btn secondary"
                onClick={() => void cancel()}
              >
                Cancelar assinatura
              </AsyncButton>
            )}
          </div>
        </div>
      )}

      <div className="plan-grid">
        {plans.map((p) => {
          const current = p.id === subscription?.plan_id;
          const pending = p.id === subscription?.pending_plan_id && !current;
          return (
            <article
              className={`panel plan-card ${current ? "current" : ""} ${pending ? "pending" : ""}`}
              key={p.id}
            >
              <span>{current ? "ATUAL" : pending ? "AGUARDANDO PAGAMENTO" : "PLANO"}</span>
              <h2>{p.name}</h2>
              {p.promotion_percent > 0 && (
                <span className="promo-badge">LANÇAMENTO · {p.promotion_percent}% OFF</span>
              )}
              <PlanPrice plan={p} compact />
              <ul>
                <li><Check />{p.screen_limit} {p.screen_limit === 1 ? "tela" : "telas"}</li>
              </ul>
              {!current && !pending && role === "owner" && (
                <AsyncButton
                  busy={busy}
                  className="btn primary full"
                  onClick={() => void checkout(p)}
                >
                  <CreditCard />
                  Selecionar
                </AsyncButton>
              )}
            </article>
          );
        })}
      </div>

      <section className="panel history">
        <div className="panel-title">
          <h2>Pagamentos</h2>
        </div>
        <div className="table">
          <div className="tr th">
            <span>Data</span>
            <span>Descrição</span>
            <span>Valor</span>
            <span>Status</span>
          </div>
          {payments.length ? (
            payments.map((payment) => (
              <div className="tr" key={payment.id}>
                <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                <span>Assinatura PontoView</span>
                <span>{money(payment.amount_cents)}</span>
                <span>{paymentStatus(payment.status)}</span>
              </div>
            ))
          ) : (
            <div className="table-empty">Nenhum pagamento registrado.</div>
          )}
        </div>
      </section>
    </>
  );
}

function PlanPrice({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const hasPromotion = Boolean(
    plan.promotion_percent > 0 &&
      plan.list_price_cents &&
      plan.list_price_cents > plan.price_cents,
  );
  return (
    <div className={`price ${compact ? "compact-price" : ""}`}>
      {hasPromotion && (
        <span className="price-list">de {money(Number(plan.list_price_cents))}</span>
      )}
      <span className="price-current">
        <strong>{money(plan.price_cents)}</strong>
        <small>/mês</small>
      </span>
    </div>
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function statusName(value: string) {
  return (
    ({
      trial: "Teste",
      active: "Ativa",
      past_due: "Pendente",
      canceled: "Cancelada",
      suspended: "Suspensa",
    } as Record<string, string>)[value] || value
  );
}

function paymentStatus(value: string) {
  return (
    ({
      approved: "Pago",
      paid: "Pago",
      pending: "Pendente",
      rejected: "Recusado",
      cancelled: "Cancelado",
    } as Record<string, string>)[value] || value
  );
}

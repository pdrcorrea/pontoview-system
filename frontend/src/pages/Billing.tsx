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
  screen_limit: number;
  user_limit: number;
  features: Record<string, boolean>;
};

type Subscription = {
  id: string;
  status: string;
  plan_id: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  plans: Plan | null;
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
        .select("*,plans(*)")
        .eq("organization_id", organization.id)
        .maybeSingle(),
      supabase
        .from("billing_payments")
        .select("id,status,amount_cents,paid_at,created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
    ]);
    if (p.data) setPlans(p.data as Plan[]);
    if (s.data) setSubscription(s.data as unknown as Subscription);
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
            <div className="price">
              <strong>{money(plan.price_cents)}</strong>
              <span>/ mês</span>
            </div>
            <small>
              {plan.screen_limit} {plan.screen_limit === 1 ? "tela" : "telas"} · {plan.user_limit} usuários
            </small>
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
        {plans.map((p) => (
          <article
            className={`panel plan-card ${p.id === subscription?.plan_id ? "current" : ""}`}
            key={p.id}
          >
            <span>{p.id === subscription?.plan_id ? "ATUAL" : "PLANO"}</span>
            <h2>{p.name}</h2>
            <div className="price">
              <strong>{money(p.price_cents)}</strong>
              <small>/mês</small>
            </div>
            <ul>
              <li><Check />{p.screen_limit} {p.screen_limit === 1 ? "tela" : "telas"}</li>
              <li><Check />{p.user_limit} usuários</li>
            </ul>
            {p.id !== subscription?.plan_id && role === "owner" && (
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
        ))}
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

import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, CreditCard, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  FormMessage,
  PageHead,
  formatDate,
} from "../components/ui";
import { invokeFunction } from "../lib/supabase";

type Subscription = {
  id: string;
  status: string;
  provider_subscription_id: string | null;
  provider_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  unit_price_cents: number;
  projected_amount_cents: number;
};

type Usage = {
  billingModel: string;
  unitPriceCents: number;
  activeScreens: number;
  trialEndsAt: string | null;
  trialActive: boolean;
  trialDaysRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodDays: number;
  screenDaysAccrued: number;
  screenDaysProjected: number;
  accruedAmountCents: number;
  projectedAmountCents: number;
};

type Payment = {
  id: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

type BillingSummary = {
  subscription: Subscription | null;
  usage: Usage | null;
  payments: Payment[];
};

export function BillingPage() {
  const { organization, role } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<BillingSummary>("screens-billing", {
        action: "summary",
      });
      setSubscription(result.subscription);
      setUsage(result.usage);
      setPayments(result.payments || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? friendlyBillingError(cause.message)
          : "Não foi possível carregar o financeiro.",
      );
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkout = async () => {
    if (!organization) return;
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{ checkoutUrl: string }>(
        "screens-billing",
        {
          action: "checkout",
          organizationId: organization.id,
        },
      );
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof Error
          ? friendlyBillingError(cause.message)
          : "Não foi possível abrir o Mercado Pago.",
      );
    }
  };

  const cancel = async () => {
    if (!organization || !subscription || !usage) return;
    const message = usage.trialActive
      ? "Cancelar a cobrança recorrente? Seu período gratuito continuará disponível até o fim do teste."
      : "Cancelar a cobrança recorrente? O ciclo já utilizado será fechado normalmente e não haverá renovação depois dele.";
    if (!confirm(message)) return;

    setBusy(true);
    setError(null);
    try {
      await invokeFunction("screens-billing", {
        action: "cancel",
        organizationId: organization.id,
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? friendlyBillingError(cause.message)
          : "Não foi possível cancelar a cobrança recorrente.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading && !usage) {
    return (
      <>
        <PageHead
          eyebrow="Financeiro"
          title="PontoView Telas"
          text="Carregando sua cobrança por uso."
        />
        <div className="panel"><p>Carregando informações financeiras…</p></div>
      </>
    );
  }

  const providerStatus = String(subscription?.provider_status || "").toLowerCase();
  const providerConfigured = Boolean(
    subscription?.provider_subscription_id &&
      ["authorized", "payment_approved", "paused"].includes(providerStatus),
  );
  const providerPending = Boolean(
    subscription?.provider_subscription_id && providerStatus === "pending",
  );
  const canceled = subscription?.status === "canceled";
  const paymentNeeded = !canceled && !providerConfigured;
  const status = billingStatus(subscription, usage, providerConfigured);
  const statusActive = !canceled && (
    Boolean(usage?.trialActive) ||
    providerConfigured ||
    subscription?.status === "active"
  );
  const nextDate = usage?.trialActive ? usage.trialEndsAt : usage?.periodEnd;
  const periodProgress = usage?.periodDays
    ? Math.min(100, Math.round((usage.screenDaysAccrued / Math.max(1, usage.screenDaysProjected)) * 100))
    : 0;

  return (
    <>
      <PageHead
        eyebrow="Financeiro"
        title="PontoView Telas"
        text="Uma cobrança simples: R$ 29 por tela ao mês, proporcional aos dias em que ela permanecer vinculada."
      />
      <FormMessage error={error} />

      {usage && subscription && (
        <>
          <div className="billing-hero panel">
            <div>
              <span className="eyebrow">COBRANÇA POR USO</span>
              <h2>PontoView Telas</h2>
              {usage.trialActive && (
                <span className="promo-badge">5 DIAS GRÁTIS</span>
              )}
              <div className="price">
                <strong>{money(usage.unitPriceCents)}</strong>
                <span>/ tela / mês</span>
              </div>
              <small>
                O valor é proporcional aos dias de vinculação. Uma tela offline continua vinculada e, portanto, continua na medição.
              </small>
            </div>

            <div className="billing-status">
              <span className={`status ${statusActive ? "active" : "offline-status"}`}>
                <Check /> {status}
              </span>
              <small>{usage.trialActive ? "Fim do período gratuito" : "Fechamento do ciclo"}</small>
              <b>{formatDate(nextDate)}</b>

              {usage.trialActive && (
                <small style={{ marginTop: 0 }}>
                  {trialCopy(usage.trialDaysRemaining)}. Nenhuma diária do teste será cobrada depois.
                </small>
              )}

              {subscription.cancel_at_period_end && (
                <small className="pending-plan-note">
                  Cancelamento agendado para o fim deste ciclo.
                </small>
              )}
            </div>
          </div>

          <div className="billing-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Uso do ciclo</h2>
                  <p>A conta é feita por tela × dia de vinculação.</p>
                </div>
                <Monitor />
              </div>

              <div className="payment-line">
                <span><b>Telas vinculadas agora</b><small>Online ou offline</small></span>
                <strong>{usage.activeScreens}</strong>
              </div>
              <div className="payment-line">
                <span><b>Dias de tela acumulados</b><small>Screen-days no período atual</small></span>
                <strong>{usage.trialActive ? "Grátis" : usage.screenDaysAccrued}</strong>
              </div>
              <div className="payment-line">
                <span><b>{usage.trialActive ? "Estimativa do 1º ciclo pago" : "Acumulado até hoje"}</b><small>{usage.trialActive ? "Se as telas atuais permanecerem vinculadas" : "Valor proporcional já utilizado"}</small></span>
                <strong>{money(usage.trialActive ? usage.projectedAmountCents : usage.accruedAmountCents)}</strong>
              </div>

              {!usage.trialActive && usage.screenDaysProjected > 0 && (
                <div className="usage">
                  <div><span>Consumo do ciclo</span><b>{usage.screenDaysAccrued} de {usage.screenDaysProjected} screen-days projetados</b></div>
                  <div className="usage-bar"><i style={{ width: `${periodProgress}%` }} /></div>
                </div>
              )}
            </section>

            <section className="panel payment-card">
              <div className="panel-title">
                <div>
                  <h2>Pagamento</h2>
                  <p>A medição é diária, mas o fechamento acontece uma vez por mês.</p>
                </div>
                <CreditCard />
              </div>

              <div className="payment-line">
                <span className="mp-mark">MP</span>
                <span>
                  <b>{providerConfigured ? "Mercado Pago configurado" : providerPending ? "Configuração pendente" : "Forma de pagamento não configurada"}</b>
                  <small>{providerConfigured ? "A cobrança acompanha automaticamente as telas vinculadas." : "Cadastre o pagamento para continuar após o período gratuito."}</small>
                </span>
              </div>

              {paymentNeeded && usage.activeScreens > 0 && role === "owner" && (
                <AsyncButton busy={busy} className="btn primary full" onClick={() => void checkout()}>
                  <CreditCard /> {providerPending ? "Continuar no Mercado Pago" : "Cadastrar forma de pagamento"}
                </AsyncButton>
              )}

              {paymentNeeded && usage.activeScreens === 0 && (
                <Link className="btn primary full" to="/telas?parear=1">
                  <Monitor /> Conectar primeira tela
                </Link>
              )}

              {providerConfigured && !subscription.cancel_at_period_end && role === "owner" && (
                <AsyncButton busy={busy} className="btn secondary full" onClick={() => void cancel()}>
                  Cancelar cobrança recorrente
                </AsyncButton>
              )}
            </section>
          </div>

          <section className="panel history">
            <div className="panel-title">
              <div>
                <h2>Como a cobrança funciona</h2>
                <p>O estado online da TV nunca altera o valor. O que importa é o vínculo.</p>
              </div>
              <Clock3 />
            </div>
            <div className="table">
              <div className="tr th">
                <span>Evento</span>
                <span>O que acontece</span>
                <span>Medição</span>
                <span>Resultado</span>
              </div>
              <div className="tr">
                <span>Vincular tela</span>
                <span>A tela entra na conta naquele dia.</span>
                <span>1 screen-day</span>
                <span>Começa a medir</span>
              </div>
              <div className="tr">
                <span>TV offline</span>
                <span>O vínculo com a conta continua existindo.</span>
                <span>Normal</span>
                <span>Continua medindo</span>
              </div>
              <div className="tr">
                <span>Desvincular</span>
                <span>O dia da desvinculação conta uma única vez.</span>
                <span>Último dia</span>
                <span>Para de medir</span>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="panel history">
        <div className="panel-title">
          <div>
            <h2>Pagamentos</h2>
            <p>Histórico dos fechamentos mensais.</p>
          </div>
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
                <span>{paymentPeriod(payment)}</span>
                <span>{money(payment.amount_cents)}</span>
                <span>{paymentStatus(payment.status)}</span>
              </div>
            ))
          ) : (
            <div className="table-empty">Nenhum pagamento registrado ainda.</div>
          )}
        </div>
      </section>
    </>
  );
}

function billingStatus(
  subscription: Subscription | null,
  usage: Usage | null,
  providerConfigured: boolean,
) {
  if (!subscription) return "Indisponível";
  if (subscription.status === "canceled") return "Cancelada";
  if (subscription.status === "past_due") return "Pagamento pendente";
  if (subscription.status === "suspended") return "Suspensa";
  if (usage?.trialActive) return "Teste gratuito";
  if (providerConfigured || subscription.status === "active") return "Ativa";
  return "Pagamento necessário";
}

function trialCopy(days: number) {
  if (days <= 0) return "O teste termina hoje";
  if (days === 1) return "Resta 1 dia grátis";
  return `Restam ${days} dias grátis`;
}

function paymentPeriod(payment: Payment) {
  if (!payment.period_start || !payment.period_end) return "PontoView Telas";
  return `Telas vinculadas · ${formatDate(payment.period_start)} a ${formatDate(payment.period_end)}`;
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

function paymentStatus(value: string) {
  return (
    ({
      approved: "Pago",
      paid: "Pago",
      pending: "Pendente",
      rejected: "Recusado",
      cancelled: "Cancelado",
      canceled: "Cancelado",
    } as Record<string, string>)[value] || value
  );
}

function friendlyBillingError(value: string) {
  if (value.includes("CONNECT_A_SCREEN_FIRST"))
    return "Conecte pelo menos uma tela antes de cadastrar a cobrança.";
  if (value.includes("MERCADO_PAGO_NOT_CONFIGURED"))
    return "O Mercado Pago ainda não está configurado para esta conta.";
  if (value.includes("SUBSCRIPTION_NOT_FOUND"))
    return "Não encontramos a assinatura desta empresa.";
  return value;
}

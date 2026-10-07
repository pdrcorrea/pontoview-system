import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Monitor, ShieldCheck } from "lucide-react";
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
  cancel_at_period_end: boolean;
  billing_exempt?: boolean;
  billing_exempt_reason?: string | null;
};

type Usage = {
  unitPriceCents: number;
  activeScreens: number;
  trialEndsAt: string | null;
  trialActive: boolean;
  trialDaysRemaining: number;
  periodEnd: string | null;
  billingExempt?: boolean;
};

type Payment = {
  id: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
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
      const result = await invokeFunction<BillingSummary>("screens-billing", { action: "summary" });
      setSubscription(result.subscription);
      setUsage(result.usage);
      setPayments(result.payments || []);
    } catch (cause) {
      setError(cause instanceof Error ? friendlyBillingError(cause.message) : "Não foi possível carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => { void load(); }, [load]);

  const checkout = async () => {
    if (!organization) return;
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{ checkoutUrl: string }>("screens-billing", {
        action: "checkout",
        organizationId: organization.id,
      });
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? friendlyBillingError(cause.message) : "Não foi possível abrir o Mercado Pago.");
    }
  };

  const cancel = async () => {
    if (!organization || !subscription || !usage) return;
    const message = usage.trialActive
      ? "Cancelar a cobrança recorrente? Seu teste gratuito continuará disponível até o fim."
      : "Cancelar a assinatura ao final do ciclo atual?";
    if (!confirm(message)) return;

    setBusy(true);
    setError(null);
    try {
      await invokeFunction("screens-billing", { action: "cancel", organizationId: organization.id });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? friendlyBillingError(cause.message) : "Não foi possível cancelar a assinatura.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !usage) {
    return (
      <>
        <PageHead eyebrow="Financeiro" title="PontoView Telas" text="Carregando informações da assinatura." />
        <div className="panel"><p>Carregando informações financeiras…</p></div>
      </>
    );
  }

  const exempt = Boolean(subscription?.billing_exempt || usage?.billingExempt);
  const providerStatus = String(subscription?.provider_status || "").toLowerCase();
  const providerConfigured = Boolean(
    subscription?.provider_subscription_id && ["authorized", "payment_approved", "paused"].includes(providerStatus),
  );
  const providerPending = Boolean(subscription?.provider_subscription_id && providerStatus === "pending");
  const canceled = subscription?.status === "canceled";
  const paymentNeeded = !exempt && !canceled && !providerConfigured;
  const status = billingStatus(subscription, usage, providerConfigured, exempt);
  const statusActive = exempt || (!canceled && (Boolean(usage?.trialActive) || providerConfigured || subscription?.status === "active"));
  const nextDate = usage?.trialActive ? usage.trialEndsAt : usage?.periodEnd;
  const monthlyValue = exempt ? 0 : (usage?.activeScreens || 0) * (usage?.unitPriceCents || 0);

  return (
    <>
      <PageHead eyebrow="Financeiro" title="PontoView Telas" text="Gerencie sua assinatura e seus pagamentos." />
      <FormMessage error={error} />

      {usage && subscription && (
        <>
          <div className="billing-hero panel">
            <div>
              <span className="eyebrow">ASSINATURA</span>
              <h2>PontoView Telas</h2>
              {!exempt && usage.trialActive && <span className="promo-badge">5 DIAS GRÁTIS</span>}
              {exempt ? (
                <div className="price"><strong>Isenta</strong><span>sem cobrança</span></div>
              ) : (
                <div className="price"><strong>{money(usage.unitPriceCents)}</strong><span>/ tela / mês</span></div>
              )}
              <small>{exempt ? "Conta administrativa liberada de cobranças recorrentes." : "Adicione ou remova telas quando precisar."}</small>
            </div>

            <div className="billing-status">
              <span className={`status ${statusActive ? "active" : "offline-status"}`}><Check /> {status}</span>
              {exempt ? (
                <>
                  <small>Condição da conta</small>
                  <b>Sem vencimento</b>
                </>
              ) : (
                <>
                  <small>{usage.trialActive ? "Teste grátis até" : "Próxima cobrança"}</small>
                  <b>{formatDate(nextDate)}</b>
                  {usage.trialActive && <small style={{ marginTop: 0 }}>{trialCopy(usage.trialDaysRemaining)}</small>}
                </>
              )}
              {!exempt && subscription.cancel_at_period_end && (
                <small className="pending-plan-note">A assinatura será encerrada ao final do ciclo atual.</small>
              )}
            </div>
          </div>

          <div className="billing-grid">
            <section className="panel">
              <div className="panel-title">
                <div><h2>Sua assinatura</h2><p>Resumo das telas vinculadas à sua conta.</p></div>
                <Monitor />
              </div>
              <div className="payment-line">
                <span><b>Telas vinculadas</b><small>Telas ativas na sua conta</small></span>
                <strong>{usage.activeScreens}</strong>
              </div>
              <div className="payment-line">
                <span><b>Valor mensal</b><small>{exempt ? "Conta isenta" : "Com a quantidade atual de telas"}</small></span>
                <strong>{money(monthlyValue)}</strong>
              </div>
              {!exempt && usage.trialActive && (
                <div className="payment-line">
                  <span><b>Período gratuito</b><small>Você ainda não será cobrado</small></span>
                  <strong>R$ 0,00</strong>
                </div>
              )}
            </section>

            {exempt ? (
              <section className="panel payment-card">
                <div className="panel-title">
                  <div><h2>Conta isenta</h2><p>Nenhuma forma de pagamento é necessária.</p></div>
                  <ShieldCheck />
                </div>
                <div className="payment-line">
                  <span className="screen-device-icon"><ShieldCheck /></span>
                  <span><b>Cobranças desativadas</b><small>Esta organização não gera cobrança recorrente nem entra em suspensão financeira.</small></span>
                </div>
              </section>
            ) : (
              <section className="panel payment-card">
                <div className="panel-title">
                  <div><h2>Pagamento</h2><p>Pagamento seguro pelo Mercado Pago.</p></div>
                  <CreditCard />
                </div>
                <div className="payment-line">
                  <span className="mp-mark">MP</span>
                  <span>
                    <b>{providerConfigured ? "Mercado Pago configurado" : providerPending ? "Configuração pendente" : "Forma de pagamento não configurada"}</b>
                    <small>{providerConfigured ? "Sua forma de pagamento está pronta." : "Cadastre uma forma de pagamento para manter a assinatura ativa."}</small>
                  </span>
                </div>
                {paymentNeeded && usage.activeScreens > 0 && role === "owner" && (
                  <AsyncButton busy={busy} className="btn primary full" onClick={() => void checkout()}>
                    <CreditCard /> {providerPending ? "Continuar no Mercado Pago" : "Cadastrar forma de pagamento"}
                  </AsyncButton>
                )}
                {paymentNeeded && usage.activeScreens === 0 && (
                  <Link className="btn primary full" to="/telas?parear=1"><Monitor /> Conectar primeira tela</Link>
                )}
                {providerConfigured && !subscription.cancel_at_period_end && role === "owner" && (
                  <AsyncButton busy={busy} className="btn secondary full" onClick={() => void cancel()}>Cancelar assinatura</AsyncButton>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {!exempt && (
        <section className="panel history">
          <div className="panel-title"><div><h2>Histórico de pagamentos</h2><p>Últimos pagamentos da sua assinatura.</p></div></div>
          <div className="table">
            <div className="tr th"><span>Data</span><span>Descrição</span><span>Valor</span><span>Status</span></div>
            {payments.length ? payments.map((payment) => (
              <div className="tr" key={payment.id}>
                <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                <span>PontoView Telas</span>
                <span>{money(payment.amount_cents)}</span>
                <span>{paymentStatus(payment.status)}</span>
              </div>
            )) : <div className="table-empty">Nenhum pagamento registrado ainda.</div>}
          </div>
        </section>
      )}
    </>
  );
}

function billingStatus(subscription: Subscription | null, usage: Usage | null, providerConfigured: boolean, exempt: boolean) {
  if (!subscription) return "Indisponível";
  if (exempt) return "Isenta de cobrança";
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

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);
}

function paymentStatus(value: string) {
  return ({ approved: "Pago", paid: "Pago", pending: "Pendente", rejected: "Recusado", cancelled: "Cancelado", canceled: "Cancelado" } as Record<string, string>)[value] || value;
}

function friendlyBillingError(value: string) {
  if (value.includes("CONNECT_A_SCREEN_FIRST")) return "Conecte pelo menos uma tela antes de cadastrar a forma de pagamento.";
  if (value.includes("MERCADO_PAGO_NOT_CONFIGURED")) return "O Mercado Pago ainda não está configurado para esta conta.";
  if (value.includes("MERCADO_PAGO_REQUEST_INVALID") || value.includes("MERCADO_PAGO_400")) return "Não foi possível iniciar o Mercado Pago. Tente novamente em instantes.";
  if (value.includes("SUBSCRIPTION_NOT_FOUND")) return "Não encontramos a assinatura desta empresa.";
  return value;
}

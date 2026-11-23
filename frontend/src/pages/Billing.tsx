import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Monitor, ShieldCheck, ChevronDown, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  FormMessage,
  PageHead,
  formatDate,
} from "../components/ui";
import { invokeFunction } from "../lib/supabase";
import "./billing-clean.css";

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
      setError(cause instanceof Error ? friendlyBillingError(cause.message) : "Não foi possível abrir o ambiente de pagamento.");
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
      <PageHead eyebrow="" title="Financeiro" text="Sua assinatura e seus pagamentos em um só lugar." />
      <FormMessage error={error} />

      {usage && subscription && (
        <>
          <section className="panel billing-clean-summary">
            <div className="billing-clean-top">
              <div>
                <span className="billing-clean-label">Assinatura PontoView Telas</span>
                <div className="billing-clean-total">{exempt ? "Isenta" : money(monthlyValue)} {!exempt && <small>/ mês</small>}</div>
                {!exempt && <p>{money(usage.unitPriceCents)} por tela · {usage.activeScreens} {usage.activeScreens === 1 ? "tela" : "telas"}</p>}
              </div>
              <span className={`status ${statusActive ? "active" : "offline-status"}`}><Check size={14} /> {status}</span>
            </div>
            <div className="billing-clean-facts">
              <div><span><Monitor size={17} /> Telas vinculadas</span><strong>{usage.activeScreens}</strong></div>
              <div><span>{exempt ? "Condição" : usage.trialActive ? "Teste gratuito até" : "Próximo vencimento"}</span><strong>{exempt ? "Sem cobrança" : formatDate(nextDate)}</strong></div>
              <div><span>Plano</span><strong>Mensal por tela</strong></div>
            </div>
            {usage.trialActive && !exempt && <p className="billing-clean-note">{trialCopy(usage.trialDaysRemaining)}</p>}
            {subscription.cancel_at_period_end && !exempt && <p className="billing-clean-note">A assinatura será encerrada ao final do período atual.</p>}
          </section>

          <section className="panel billing-clean-method">
            <div className="billing-clean-method-info">
              <span className="billing-clean-method-icon">{exempt ? <ShieldCheck size={21} /> : <CreditCard size={21} />}</span>
              <div><h2>{exempt ? "Conta isenta" : "Forma de pagamento"}</h2><p>{exempt ? "Nenhuma cobrança será gerada." : providerConfigured ? "Cadastrada para cobranças recorrentes." : providerPending ? "Configuração pendente." : "Nenhuma forma de pagamento cadastrada."}</p></div>
            </div>
            <div className="billing-clean-actions">
              {paymentNeeded && usage.activeScreens > 0 && role === "owner" && <AsyncButton busy={busy} className="btn primary" onClick={() => void checkout()}>{providerPending ? "Continuar configuração" : "Cadastrar pagamento"}</AsyncButton>}
              {paymentNeeded && usage.activeScreens === 0 && <Link className="btn primary" to="/telas?parear=1">Conectar primeira tela</Link>}
              {providerConfigured && !subscription.cancel_at_period_end && role === "owner" && <AsyncButton busy={busy} className="btn secondary" onClick={() => void cancel()}>Cancelar assinatura</AsyncButton>}
            </div>
          </section>
        </>
      )}

      {!exempt && (
        <section className="panel billing-clean-history billing-ledger">
          <div className="panel-title">
            <div><h2>Histórico de pagamentos</h2><p>Consulte os detalhes das suas mensalidades.</p></div>
            <ReceiptText size={21} aria-hidden="true" />
          </div>
          {payments.length ? (
            <div className="billing-ledger-list">
              {payments.map((payment) => (
                <details className="billing-ledger-entry" key={payment.id}>
                  <summary>
                    <span className="billing-ledger-main">
                      <strong>{formatDate(payment.paid_at || payment.created_at)}</strong>
                      <small>PontoView Telas · Mensalidade</small>
                    </span>
                    <span className="billing-ledger-side">
                      <strong>{money(payment.amount_cents)}</strong>
                      <span className={`billing-ledger-badge billing-ledger-${payment.status === "approved" || payment.status === "paid" ? "paid" : payment.status === "pending" ? "pending" : "other"}`}>
                        {paymentStatus(payment.status)}
                      </span>
                    </span>
                    <ChevronDown className="billing-ledger-chevron" size={18} aria-hidden="true" />
                  </summary>
                  <div className="billing-ledger-details">
                    <div><span>Descrição</span><b>Assinatura PontoView Telas</b></div>
                    <div><span>Situação</span><b>{paymentStatus(payment.status)}</b></div>
                    <div><span>Valor</span><b>{money(payment.amount_cents)}</b></div>
                    <div><span>Data</span><b>{formatDate(payment.paid_at || payment.created_at)}</b></div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="billing-ledger-empty">
              <ReceiptText size={24} aria-hidden="true" />
              <strong>Nenhuma confirmação registrada</strong>
              <p>Quando um pagamento for confirmado, ele aparecerá aqui automaticamente. Em caso de cobrança já realizada, entre em contato com o suporte.</p>
              <Link to="/suporte" className="btn secondary">Falar com suporte</Link>
            </div>
          )}
        </section>
      )}
      {!exempt && usage && nextDate && !usage.trialActive && !canceled && (
        <p className="billing-ledger-footnote">Próximo vencimento previsto: <strong>{formatDate(nextDate)}</strong>. Uma data prevista não significa que o pagamento foi confirmado.</p>
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
  if (value.includes("MERCADO_PAGO_NOT_CONFIGURED")) return "O processamento de pagamentos ainda não está disponível para esta conta.";
  if (value.includes("MERCADO_PAGO_REQUEST_INVALID") || value.includes("MERCADO_PAGO_400")) return "Não foi possível iniciar o pagamento. Tente novamente em instantes.";
  if (value.includes("SUBSCRIPTION_NOT_FOUND")) return "Não encontramos a assinatura desta empresa.";
  return value;
}

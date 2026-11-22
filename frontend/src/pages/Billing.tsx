import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Monitor, RefreshCw, ShieldCheck } from "lucide-react";
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

type PaymentDiagnostic = {
  local: { status: string; providerStatus: string | null; periodEnd: string | null };
  remote: { status: string | null; nextDebitDate: string | null; lastChargedDate: string | null; lastChargedAmount: number | null };
  invoices: Array<{ authorizedPaymentId: string; paymentId: string | null; paymentStatus: string; invoiceStatus: string; amount: number; debitDate: string | null }>;
  truncated: boolean;
};

export function BillingPage() {
  const { organization, role } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<PaymentDiagnostic | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticCooldownUntil, setDiagnosticCooldownUntil] = useState(() => {
    try { return Number(sessionStorage.getItem("pv_payment_check_cooldown") || 0); }
    catch { return 0; }
  });

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

  const checkPayment = async () => {
    if (!organization || role !== "owner") return;
    if (Date.now() < diagnosticCooldownUntil) return;
    setDiagnosing(true);
    setDiagnosticError(null);
    setDiagnostic(null);
    try {
      const result = await invokeFunction<PaymentDiagnostic>("screens-payment-diagnostic", {
        organizationId: organization.id,
      });
      setDiagnostic(result);
    } catch (cause) {
      const limited = cause instanceof Error && cause.message.includes("PROVIDER_RATE_LIMIT");
      if (limited) {
        const cooldownUntil = Date.now() + 10 * 60_000;
        setDiagnosticCooldownUntil(cooldownUntil);
        try { sessionStorage.setItem("pv_payment_check_cooldown", String(cooldownUntil)); } catch { /* storage unavailable */ }
      }
      setDiagnosticError(limited
        ? "A verificação está temporariamente indisponível. Aguarde pelo menos 10 minutos antes de tentar novamente."
        : "Não foi possível atualizar as informações agora. Nenhum pagamento ou assinatura foi alterado.");
    } finally {
      setDiagnosing(false);
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
        <section className="panel history billing-clean-history">
          <div className="panel-title"><div><h2>Pagamentos</h2><p>Histórico das cobranças da assinatura.</p></div></div>
          <div className="table billing-clean-table">
            <div className="tr th"><span>Data</span><span>Descrição</span><span>Valor</span><span>Status</span></div>
            {payments.length ? payments.map((payment) => (
              <div className="tr" key={payment.id}>
                <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                <span>PontoView Telas</span>
                <span>{money(payment.amount_cents)}</span>
                <span>{paymentStatus(payment.status)}</span>
              </div>
            )) : <div className="table-empty">Ainda não há pagamentos registrados.</div>}
          </div>
        </section>
      )}

      {!exempt && subscription?.provider_subscription_id && role === "owner" && (
        <details className="billing-clean-detail">
          <summary>Verificação de pagamento</summary>
          <div className="billing-clean-detail-body">
            <p>Confira a situação de uma cobrança. Esta consulta não altera sua assinatura.</p>
            <AsyncButton busy={diagnosing} disabled={Date.now() < diagnosticCooldownUntil} className="btn secondary" onClick={() => void checkPayment()}>
              <RefreshCw size={16} /> {Date.now() < diagnosticCooldownUntil ? "Aguarde para tentar novamente" : "Verificar pagamento"}
            </AsyncButton>
            <FormMessage error={diagnosticError} />
            {diagnostic && (
            <div className="table" style={{ marginTop: 16 }}>
              <div className="payment-line">
                <span><b>Situação da assinatura</b><small>Status informado pelo processador de pagamentos</small></span>
                <strong>{diagnostic.remote.status || "Não informado"}</strong>
              </div>
              <div className="payment-line">
                <span><b>Próxima cobrança prevista</b></span>
                <strong>{diagnostic.remote.nextDebitDate ? formatDate(diagnostic.remote.nextDebitDate) : "Não informada"}</strong>
              </div>
              <div className="tr th"><span>Data</span><span>Pagamento</span><span>Valor</span><span>Status</span></div>
              {diagnostic.invoices.length ? diagnostic.invoices.map((invoice) => (
                <div className="tr" key={invoice.authorizedPaymentId}>
                  <span>{invoice.debitDate ? formatDate(invoice.debitDate) : "—"}</span>
                  <span>{invoice.paymentId || invoice.authorizedPaymentId}</span>
                  <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(invoice.amount)}</span>
                  <span>{paymentStatus(invoice.paymentStatus || invoice.invoiceStatus)}</span>
                </div>
              )) : <div className="table-empty">Nenhuma fatura retornada para esta assinatura.</div>}
              {diagnostic.truncated && <p>Há outras faturas não exibidas nesta consulta.</p>}
            </div>
            )}
          </div>
        </details>
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

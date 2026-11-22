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
                  <div><h2>Pagamento</h2><p>Gerencie sua forma de pagamento com segurança.</p></div>
                  <CreditCard />
                </div>
                <div className="payment-line">
                  <span className="mp-mark">MP</span>
                  <span>
                    <b>{providerConfigured ? "Forma de pagamento configurada" : providerPending ? "Configuração pendente" : "Forma de pagamento não configurada"}</b>
                    <small>{providerConfigured ? "Sua forma de pagamento está pronta." : "Cadastre uma forma de pagamento para manter a assinatura ativa."}</small>
                  </span>
                </div>
                {paymentNeeded && usage.activeScreens > 0 && role === "owner" && (
                  <AsyncButton busy={busy} className="btn primary full" onClick={() => void checkout()}>
                    <CreditCard /> {providerPending ? "Continuar configuração" : "Cadastrar forma de pagamento"}
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

      {!exempt && subscription?.provider_subscription_id && role === "owner" && (
        <section className="panel history">
          <div className="panel-title">
            <div>
              <h2>Verificar pagamento</h2>
              <p>Consulta de diagnóstico. Não realiza cobranças nem modifica sua assinatura.</p>
            </div>
            <RefreshCw />
          </div>
          <AsyncButton busy={diagnosing} disabled={Date.now() < diagnosticCooldownUntil} className="btn secondary" onClick={() => void checkPayment()}>
            <RefreshCw /> {Date.now() < diagnosticCooldownUntil ? "Aguarde para verificar novamente" : "Verificar pagamento"}
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
  if (value.includes("MERCADO_PAGO_NOT_CONFIGURED")) return "O processamento de pagamentos ainda não está disponível para esta conta.";
  if (value.includes("MERCADO_PAGO_REQUEST_INVALID") || value.includes("MERCADO_PAGO_400")) return "Não foi possível iniciar o pagamento. Tente novamente em instantes.";
  if (value.includes("SUBSCRIPTION_NOT_FOUND")) return "Não encontramos a assinatura desta empresa.";
  return value;
}

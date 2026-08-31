import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BadgeDollarSign,
  Check,
  Headphones,
  Mail,
  MessageCircle,
  Monitor,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  FormMessage,
  PageHead,
  formData,
  formatDate,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import type { Screen } from "../types";

const SUPPORT_EMAIL = "pontoviewmidia@gmail.com";
const WHATSAPP_URL = "https://wa.me/5527999011689?text=" + encodeURIComponent("Olá, preciso de suporte urgente no PontoView Telas.");

type RequestRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
};

export function SupportPage() {
  const { organization, user } = useAuth();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [s, r] = await Promise.all([
      supabase
        .from("screens")
        .select("id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision")
        .eq("organization_id", organization.id)
        .eq("is_active", true),
      supabase
        .from("support_requests")
        .select("id,subject,category,status,created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (s.data) setScreens(s.data as Screen[]);
    if (r.data) setRequests(r.data as RequestRow[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const data = formData(e);
    const selectedScreen = screens.find((screen) => screen.id === data.screen_id);
    const context = {
      browser: navigator.userAgent,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      appVersion: __APP_VERSION__,
      url: window.location.href,
    };
    const result = await supabase.from("support_requests").insert({
      organization_id: organization.id,
      user_id: user.id,
      screen_id: data.screen_id || null,
      category: data.category,
      subject: data.subject,
      message: data.message,
      context,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess("Solicitação registrada. Seu aplicativo de e-mail será aberto com a mensagem pronta para envio.");
    await load();
    const subject = `[PontoView] ${data.subject}`;
    const body = [
      "Olá, equipe PontoView,",
      "",
      data.message,
      "",
      `Categoria: ${categoryName(data.category)}`,
      `Empresa: ${organization.display_name || organization.name}`,
      `Tela relacionada: ${selectedScreen?.name || "Não se aplica"}`,
      `Página de origem: ${context.url}`,
      "",
      "Esta solicitação também foi registrada no painel PontoView.",
    ].join("\n");
    e.currentTarget.reset();
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <PageHead
        eyebrow="Atendimento"
        title="Contato e suporte"
        text="Fale com a PontoView para questões técnicas, financeiras ou comerciais."
      />

      <div className="support-contact-strip">
        <a className="btn secondary" href={`mailto:${SUPPORT_EMAIL}`}><Mail /> {SUPPORT_EMAIL}</a>
        <a className="btn whatsapp" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp para urgências</a>
      </div>

      <div className="support-grid">
        <section className="support-options">
          <article className="panel">
            <span className="support-icon"><Monitor /></span>
            <h2>Suporte técnico</h2>
            <p>Telas, conteúdo, Player, playlists, programação e integrações.</p>
          </article>
          <article className="panel">
            <span className="support-icon"><BadgeDollarSign /></span>
            <h2>Financeiro</h2>
            <p>Plano, cobrança, assinatura ou Mercado Pago.</p>
          </article>
          <article className="panel">
            <span className="support-icon"><Users /></span>
            <h2>Comercial</h2>
            <p>Novas telas, implantação e soluções personalizadas.</p>
          </article>
        </section>

        <form className="panel support-form" onSubmit={submit}>
          <div className="panel-title">
            <div>
              <h2>Enviar solicitação</h2>
              <p>O chamado fica salvo no sistema e a mensagem é preparada para {SUPPORT_EMAIL}.</p>
            </div>
            <Headphones />
          </div>
          <label>
            Categoria
            <select name="category">
              <option value="technical">Suporte técnico</option>
              <option value="financial">Financeiro</option>
              <option value="commercial">Comercial</option>
              <option value="other">Outro assunto</option>
            </select>
          </label>
          <label>Assunto<input name="subject" minLength={3} required placeholder="Ex.: Player não atualiza a playlist" /></label>
          <label>
            Tela relacionada
            <select name="screen_id">
              <option value="">Nenhuma / não se aplica</option>
              {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
            </select>
          </label>
          <label>Mensagem<textarea name="message" minLength={10} required rows={6} placeholder="Descreva o que aconteceu, o que deveria acontecer e quando o problema começou." /></label>
          <small className="support-note">Para ocorrências que impeçam uma tela de operar e precisem de retorno rápido, use o botão de WhatsApp acima.</small>
          <FormMessage error={error} success={success} />
          <AsyncButton busy={busy} className="btn primary"><Mail /> Registrar e preparar e-mail</AsyncButton>
        </form>
      </div>

      {requests.length > 0 && (
        <section className="panel history">
          <div className="panel-title"><div><h2>Solicitações recentes</h2><p>Acompanhe o registro dos seus chamados.</p></div></div>
          <div className="table">
            <div className="tr th"><span>Data</span><span>Assunto</span><span>Categoria</span><span>Status</span></div>
            {requests.map((row) => (
              <div className="tr" key={row.id}>
                <span>{formatDate(row.created_at)}</span>
                <span>{row.subject}</span>
                <span>{categoryName(row.category)}</span>
                <span><Check /> {statusName(row.status)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function categoryName(value: string) {
  return ({ technical: "Suporte técnico", financial: "Financeiro", commercial: "Comercial", other: "Outro" } as Record<string, string>)[value] || value;
}
function statusName(value: string) {
  return ({ open: "Aberto", pending: "Em análise", resolved: "Resolvido", closed: "Encerrado" } as Record<string, string>)[value] || value;
}

declare const __APP_VERSION__: string;

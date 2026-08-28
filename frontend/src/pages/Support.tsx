import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BadgeDollarSign,
  Check,
  Headphones,
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
        .select(
          "id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision",
        )
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
  useEffect(() => {
    void load();
  }, [load]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const data = formData(e);
    const result = await supabase
      .from("support_requests")
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        screen_id: data.screen_id || null,
        category: data.category,
        subject: data.subject,
        message: data.message,
        context: {
          browser: navigator.userAgent,
          language: navigator.language,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          appVersion: __APP_VERSION__,
          url: window.location.href,
        },
      });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      setSuccess("Solicitação registrada.");
      e.currentTarget.reset();
      await load();
    }
  };
  return (
    <>
      <PageHead
        eyebrow="Atendimento"
        title="Contato e suporte"
        text="Solicitações técnicas, financeiras ou comerciais salvas com o contexto da conta."
      />
      <div className="support-grid">
        <section className="support-options">
          <article className="panel">
            <span className="support-icon">
              <Monitor />
            </span>
            <h2>Suporte técnico</h2>
            <p>Telas, conteúdo, Player e integrações.</p>
          </article>
          <article className="panel">
            <span className="support-icon">
              <BadgeDollarSign />
            </span>
            <h2>Financeiro</h2>
            <p>Plano, cobrança ou Mercado Pago.</p>
          </article>
          <article className="panel">
            <span className="support-icon">
              <Users />
            </span>
            <h2>Comercial</h2>
            <p>Mais telas e soluções personalizadas.</p>
          </article>
        </section>
        <form className="panel support-form" onSubmit={submit}>
          <div className="panel-title">
            <div>
              <h2>Enviar solicitação</h2>
              <p>Dados técnicos básicos serão anexados automaticamente.</p>
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
          <label>
            Assunto
            <input name="subject" minLength={3} required />
          </label>
          <label>
            Tela relacionada
            <select name="screen_id">
              <option value="">Nenhuma / não se aplica</option>
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mensagem
            <textarea name="message" minLength={10} required rows={6} />
          </label>
          <FormMessage error={error} success={success} />
          <AsyncButton busy={busy} className="btn primary">
            Enviar solicitação
          </AsyncButton>
        </form>
      </div>
      {requests.length > 0 && (
        <section className="panel history">
          <div className="panel-title">
            <div>
              <h2>Solicitações recentes</h2>
              <p>Acompanhe o registro dos seus chamados.</p>
            </div>
          </div>
          <div className="table">
            <div className="tr th">
              <span>Data</span>
              <span>Assunto</span>
              <span>Categoria</span>
              <span>Status</span>
            </div>
            {requests.map((row) => (
              <div className="tr" key={row.id}>
                <span>{formatDate(row.created_at)}</span>
                <span>{row.subject}</span>
                <span>{row.category}</span>
                <span>
                  <Check /> {row.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

declare const __APP_VERSION__: string;

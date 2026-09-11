import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AsyncButton, FormMessage, Modal, PageHead, formData, formatDate } from "../components/ui";
import { supabase } from "../lib/supabase";

type PersonalProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

type PrivacyRequest = {
  id: string;
  request_type: string;
  status: string;
  details: string | null;
  response_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const requestLabels: Record<string, string> = {
  access: "Acesso aos meus dados",
  correction: "Correção de dados",
  portability: "Portabilidade",
  deletion: "Exclusão de dados",
  revocation: "Revogação de consentimento",
  sharing_information: "Informações sobre compartilhamento",
  other: "Outro direito",
};

const statusLabels: Record<string, string> = {
  received: "Recebida",
  in_review: "Em análise",
  completed: "Concluída",
  rejected: "Encerrada",
};

export function UserAccountPage() {
  const { user, organization, role, refresh, signOut } = useAuth();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [requestModal, setRequestModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [profileResult, requestResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,phone,created_at,updated_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("privacy_requests")
        .select("id,request_type,status,details,response_note,created_at,resolved_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.data) setProfile(profileResult.data as PersonalProfile);
    if (requestResult.data) setRequests(requestResult.data as PrivacyRequest[]);
    if (profileResult.error) setError(profileResult.error.message);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const values = formData(event);

    const result = await supabase
      .from("profiles")
      .update({
        full_name: values.full_name.trim() || null,
        phone: values.phone.trim() || null,
      })
      .eq("id", user.id);

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess("Dados atualizados.");
    await Promise.all([load(), refresh()]);
  };

  const requestPasswordReset = async () => {
    if (!user?.email) return;
    setPasswordBusy(true);
    setError(null);
    setSuccess(null);

    const result = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setPasswordBusy(false);
    if (result.error) setError(result.error.message);
    else setSuccess("Enviamos um link para alterar sua senha.");
  };

  const createPrivacyRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) return;
    setRequestBusy(true);
    setError(null);
    const values = formData(event);

    if (values.request_type === "deletion" && !confirm("Enviar solicitação de exclusão de dados e conta?")) {
      setRequestBusy(false);
      return;
    }

    const result = await supabase.from("privacy_requests").insert({
      user_id: user.id,
      organization_id: organization?.id || null,
      requester_email: user.email,
      request_type: values.request_type,
      details: values.details.trim() || null,
    });

    setRequestBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setRequestModal(false);
    setSuccess("Solicitação registrada.");
    await load();
  };

  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);

    const [profileResult, membershipsResult, requestsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,phone,created_at,updated_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("organization_users")
        .select("organization_id,role,created_at")
        .eq("user_id", user.id),
      supabase
        .from("privacy_requests")
        .select("request_type,status,details,response_note,created_at,resolved_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setBusy(false);
    if (profileResult.error || membershipsResult.error || requestsResult.error) {
      setError(profileResult.error?.message || membershipsResult.error?.message || requestsResult.error?.message || "Não foi possível gerar o arquivo.");
      return;
    }

    const payload = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile: profileResult.data,
      memberships: membershipsResult.data,
      privacy_requests: requestsResult.data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pontoview-dados-da-conta.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead
        eyebrow="Sua conta"
        title="Minha conta"
        text="Seus dados, acesso e privacidade em um só lugar."
      />
      <FormMessage error={error} success={success} />

      <div className="user-account-grid">
        <form className="account-card account-profile-card" onSubmit={saveProfile}>
          <div className="account-card-title">
            <span><UserRound /></span>
            <div><h2>Seus dados</h2><p>Informações vinculadas ao seu acesso.</p></div>
          </div>

          <div className="account-identity">
            <span className="account-avatar">{(profile?.full_name || user?.email || "P")[0].toUpperCase()}</span>
            <div>
              <b>{profile?.full_name || "Seu perfil"}</b>
              <small>{user?.email}</small>
              <em>{roleLabel(role)} · {organization?.display_name || "PontoView"}</em>
            </div>
          </div>

          <label>Nome<input name="full_name" defaultValue={profile?.full_name || ""} /></label>
          <label>E-mail<input value={user?.email || ""} readOnly disabled /></label>
          <label>Telefone<input name="phone" defaultValue={profile?.phone || ""} inputMode="tel" /></label>

          <AsyncButton busy={busy} className="btn primary">Salvar</AsyncButton>
        </form>

        <section className="account-card">
          <div className="account-card-title">
            <span><LockKeyhole /></span>
            <div><h2>Segurança</h2><p>Controle do seu acesso.</p></div>
          </div>

          <div className="account-setting-row">
            <KeyRound />
            <span><b>Senha</b><small>Altere sua senha por link seguro enviado ao e-mail.</small></span>
            <AsyncButton busy={passwordBusy} className="btn secondary" onClick={() => void requestPasswordReset()}>Alterar</AsyncButton>
          </div>

          <div className="account-setting-row">
            <ShieldCheck />
            <span><b>Sessão</b><small>Encerre seu acesso neste dispositivo.</small></span>
            <button className="btn secondary" onClick={() => void signOut()}>Sair</button>
          </div>
        </section>
      </div>

      <section className="account-card privacy-account-card">
        <div className="account-card-title privacy-title">
          <span><ShieldCheck /></span>
          <div><h2>Privacidade</h2><p>Acesso simples aos seus direitos sobre dados pessoais.</p></div>
          <a className="btn secondary" href="https://pontoview.com.br/privacidade" target="_blank" rel="noreferrer">Central de Privacidade <ExternalLink /></a>
        </div>

        <div className="privacy-actions">
          <button className="privacy-action" onClick={() => void exportData()}>
            <Download /><span><b>Baixar dados da conta</b><small>Cópia imediata do seu perfil e acesso.</small></span>
          </button>
          <button className="privacy-action" onClick={() => setRequestModal(true)}>
            <ShieldCheck /><span><b>Exercer um direito</b><small>Pedidos formais sobre seus dados pessoais.</small></span>
          </button>
        </div>

        <div className="privacy-summary">
          <span><CheckCircle2 /><b>Você pode corrigir seus dados nesta página.</b></span>
          <span><CheckCircle2 /><b>Solicitações ficam registradas para acompanhamento.</b></span>
        </div>

        {requests.length > 0 && (
          <div className="privacy-request-list">
            <h3>Solicitações recentes</h3>
            {requests.slice(0, 5).map((request) => (
              <article key={request.id}>
                <div><b>{requestLabels[request.request_type] || "Solicitação"}</b><small>{formatDate(request.created_at)}</small></div>
                <span className={`privacy-status ${request.status}`}>{statusLabels[request.status] || request.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {requestModal && (
        <Modal eyebrow="PRIVACIDADE" title="Exercer um direito" onClose={() => setRequestModal(false)}>
          <form className="privacy-request-form" onSubmit={createPrivacyRequest}>
            <label>Solicitação
              <select name="request_type" defaultValue="access">
                <option value="access">Acesso aos meus dados</option>
                <option value="correction">Correção de dados</option>
                <option value="portability">Portabilidade</option>
                <option value="deletion">Exclusão de dados</option>
                <option value="revocation">Revogação de consentimento</option>
                <option value="sharing_information">Informações sobre compartilhamento</option>
                <option value="other">Outro direito</option>
              </select>
            </label>
            <label>Detalhes <span>(opcional)</span><textarea name="details" rows={4} maxLength={2000} placeholder="Se necessário, explique brevemente o pedido." /></label>
            <div className="privacy-request-note">A solicitação será vinculada ao seu usuário e poderá ser acompanhada nesta página.</div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setRequestModal(false)}>Cancelar</button>
              <AsyncButton busy={requestBusy} className="btn primary">Enviar solicitação</AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function roleLabel(role: string | null) {
  if (role === "owner") return "Proprietário";
  if (role === "admin") return "Administrador";
  if (role === "editor") return "Editor";
  if (role === "viewer") return "Visualizador";
  return "Usuário";
}

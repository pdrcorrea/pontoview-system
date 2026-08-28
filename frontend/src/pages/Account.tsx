import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Cloud,
  FileVideo,
  ListVideo,
  Monitor,
  ShieldCheck,
  UserRound,
  Users,
  Youtube,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AsyncButton, FormMessage, PageHead, formData } from "../components/ui";
import { invokeFunction, supabase } from "../lib/supabase";

type Membership = {
  user_id: string;
  role: string;
  profiles: { email: string; full_name: string | null } | null;
};
type DriveConnection = {
  id: string;
  google_email: string;
  status: string;
  last_sync_at: string | null;
};

export function AccountPage() {
  const { organization, profile, user, refresh } = useAuth();
  const [members, setMembers] = useState<Membership[]>([]);
  const [drives, setDrives] = useState<DriveConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!organization) return;
    const [m, d] = await Promise.all([
      supabase
        .from("organization_users")
        .select("user_id,role,profiles(email,full_name)")
        .eq("organization_id", organization.id)
        .order("created_at"),
      supabase
        .from("drive_connections")
        .select("id,google_email,status,last_sync_at")
        .eq("organization_id", organization.id)
        .order("created_at"),
    ]);
    if (m.data) setMembers(m.data as unknown as Membership[]);
    if (d.data) setDrives(d.data as DriveConnection[]);
  }, [organization]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const data = formData(e);
    const [o, p] = await Promise.all([
      supabase
        .from("organizations")
        .update({
          name: data.organization_name,
          display_name: data.display_name,
          document: data.document || null,
        })
        .eq("id", organization.id),
      supabase
        .from("profiles")
        .update({ full_name: data.full_name, phone: data.phone || null })
        .eq("id", user.id),
    ]);
    setBusy(false);
    if (o.error || p.error)
      setError(
        o.error?.message || p.error?.message || "Não foi possível salvar.",
      );
    else {
      setSuccess("Dados atualizados.");
      await refresh();
    }
  };
  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{ url: string }>(
        "drive-oauth-start",
        { returnTo: window.location.href },
      );
      window.location.assign(result.url);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar a conexão.",
      );
    }
  };
  return (
    <>
      <PageHead
        eyebrow="Conta"
        title="Minha conta"
        text="Gerencie os dados da empresa, usuários e integrações."
      />
      <FormMessage error={error} success={success} />
      <div className="settings-grid">
        <form className="panel form-card" onSubmit={save}>
          <div className="panel-title">
            <div>
              <h2>Dados da empresa</h2>
              <p>Informações usadas na conta e nos widgets.</p>
            </div>
          </div>
          <label>
            Nome da empresa
            <input name="organization_name" defaultValue={organization?.name} />
          </label>
          <label>
            Nome de exibição
            <input
              name="display_name"
              defaultValue={organization?.display_name}
            />
          </label>
          <label>
            Documento
            <input name="document" placeholder="CNPJ ou CPF" />
          </label>
          <label>
            Seu nome
            <input name="full_name" defaultValue={profile?.full_name || ""} />
          </label>
          <label>
            Telefone
            <input name="phone" />
          </label>
          <AsyncButton busy={busy} className="btn primary">
            Salvar alterações
          </AsyncButton>
        </form>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Usuários</h2>
              <p>Pessoas com acesso a esta organização</p>
            </div>
          </div>
          {members.map((member) => (
            <div className="user-row" key={member.user_id}>
              <span className="avatar">
                {(member.profiles?.full_name ||
                  member.profiles?.email ||
                  "U")[0].toUpperCase()}
              </span>
              <span className="grow">
                <b>{member.profiles?.full_name || member.profiles?.email}</b>
                <small>{roleName(member.role)}</small>
              </span>
              {member.user_id === user?.id && (
                <span className="pill">Você</span>
              )}
            </div>
          ))}
          <div className="panel-title integration-title">
            <div>
              <h2>Google Drive</h2>
              <p>Tokens protegidos no backend</p>
            </div>
          </div>
          {drives.map((drive) => (
            <div className="integration" key={drive.id}>
              <Cloud />
              <span>
                <b>{drive.google_email}</b>
                <small>
                  {drive.status === "active"
                    ? "Conectado"
                    : "Atenção necessária"}
                </small>
              </span>
              <span
                className={drive.status === "active" ? "status active" : "pill"}
              >
                {drive.status}
              </span>
            </div>
          ))}
          <AsyncButton
            busy={busy}
            className="btn secondary full"
            onClick={connect}
          >
            <Cloud />
            Conectar Google Drive
          </AsyncButton>
        </section>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { organization } = useAuth();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization) return;
    setBusy(true);
    const data = formData(e);
    const result = await supabase
      .from("organizations")
      .update({
        timezone: data.timezone,
        locale: data.locale,
        settings: {
          ...organization.settings,
          defaultImageDuration: Number(data.image_duration),
          defaultTransition: data.transition,
        },
      })
      .eq("id", organization.id);
    setBusy(false);
    if (!result.error) setSuccess("Preferências salvas.");
  };
  return (
    <>
      <PageHead
        eyebrow="Preferências"
        title="Configurações"
        text="Defina padrões para novas telas e conteúdos."
      />
      <FormMessage success={success} />
      <div className="settings-grid">
        <form className="panel form-card" onSubmit={save}>
          <h2>Padrões do Player</h2>
          <label>
            Fuso horário
            <input
              name="timezone"
              defaultValue={organization?.timezone || "America/Sao_Paulo"}
            />
          </label>
          <label>
            Idioma
            <select
              name="locale"
              defaultValue={organization?.locale || "pt-BR"}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English</option>
              <option value="es-ES">Español</option>
            </select>
          </label>
          <label>
            Duração padrão de imagens
            <input
              name="image_duration"
              type="number"
              min="3"
              defaultValue={String(
                (organization?.settings?.defaultImageDuration as number) || 15,
              )}
            />
          </label>
          <label>
            Transição
            <select
              name="transition"
              defaultValue={String(
                organization?.settings?.defaultTransition || "fade",
              )}
            >
              <option value="fade">Suave</option>
              <option value="cut">Direta</option>
            </select>
          </label>
          <AsyncButton busy={busy} className="btn primary">
            Salvar preferências
          </AsyncButton>
        </form>
        <section className="panel">
          <h2>Segurança</h2>
          <div className="setting-row">
            <ShieldCheck />
            <span>
              <b>Isolamento por organização</b>
              <small>Políticas RLS e vínculos compostos ativos</small>
            </span>
            <span className="status active">Ativo</span>
          </div>
          <div className="setting-row">
            <Cloud />
            <span>
              <b>Google Drive</b>
              <small>Credenciais mantidas fora do frontend</small>
            </span>
            <span className="status active">Protegido</span>
          </div>
        </section>
      </div>
    </>
  );
}

export function OnboardingPage() {
  const { organization, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [steps, setSteps] = useState({
    drive: false,
    media: false,
    playlist: false,
    screen: false,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!organization) return;
    void Promise.all([
      supabase
        .from("drive_connections")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "active"),
      supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .neq("status", "archived"),
      supabase
        .from("playlists")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id),
      supabase
        .from("screens")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("is_active", true),
    ]).then(([d, m, p, s]) =>
      setSteps({
        drive: Boolean(d.count),
        media: Boolean(m.count),
        playlist: Boolean((p.count || 0) > 1),
        screen: Boolean(s.count),
      }),
    );
  }, [organization]);
  const finish = async () => {
    if (!user) return;
    setBusy(true);
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    await refresh();
    navigate("/dashboard");
  };
  const cards = [
    [
      "Conta criada",
      true,
      UserRound,
      "Seus dados e empresa já estão protegidos.",
      "/conta",
    ],
    [
      "Conectar Google Drive",
      steps.drive,
      Cloud,
      "Use seus próprios arquivos sem reenviar tudo.",
      "/conta",
    ],
    [
      "Adicionar conteúdo",
      steps.media,
      FileVideo,
      "Inclua Drive, YouTube, páginas ou Apps.",
      "/conteudo",
    ],
    [
      "Criar playlist",
      steps.playlist,
      ListVideo,
      "Organize a sequência de exibição.",
      "/playlists",
    ],
    [
      "Conectar uma tela",
      steps.screen,
      Monitor,
      "Abra o Player na TV e use o código.",
      "/telas?parear=1",
    ],
  ] as const;
  return (
    <div className="onboarding-page">
      <div className="onboarding-intro">
        <small>PRIMEIROS PASSOS</small>
        <h1>Vamos colocar sua primeira tela no ar.</h1>
        <p>
          Siga o fluxo no seu ritmo. Você poderá voltar a estes guias pela
          Central de Ajuda.
        </p>
      </div>
      <div className="onboarding-cards">
        {cards.map(([title, done, Icon, text, to], index) => (
          <button
            key={title}
            onClick={() => navigate(to)}
            className={done ? "done" : ""}
          >
            <span>{done ? <Check /> : index + 1}</span>
            <Icon />
            <div>
              <b>{title}</b>
              <small>{text}</small>
            </div>
          </button>
        ))}
      </div>
      <AsyncButton
        busy={busy}
        className="btn primary onboarding-finish"
        onClick={() => void finish()}
      >
        Ir para o painel
      </AsyncButton>
    </div>
  );
}
function roleName(role: string) {
  return (
    (
      {
        owner: "Proprietário",
        admin: "Administrador",
        editor: "Editor",
        viewer: "Visualizador",
      } as Record<string, string>
    )[role] || role
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  HelpCircle,
  ListVideo,
  Monitor,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { PageHead, timeAgo } from "../components/ui";
import { supabase } from "../lib/supabase";
import type { DashboardData, Screen } from "../types";

const empty: DashboardData = {
  screensTotal: 0,
  screensOnline: 0,
  media: 0,
  playlists: 0,
  activeSchedules: 0,
  recentEvents: [],
};

const quickActions = [
  {
    step: "1",
    title: "Conectar Google Drive",
    text: "Autorize seus arquivos para usar imagens e vídeos sem duplicar a biblioteca.",
    to: "/empresa#google-drive",
    icon: Cloud,
  },
  {
    step: "2",
    title: "Adicionar conteúdo",
    text: "Escolha arquivos do Drive, YouTube, páginas ou painéis prontos.",
    to: "/conteudo",
    icon: Cloud,
  },
  {
    step: "3",
    title: "Criar uma playlist",
    text: "Organize a ordem do que será exibido na TV.",
    to: "/playlists",
    icon: ListVideo,
  },
  {
    step: "4",
    title: "Conectar uma TV",
    text: "Use o código mostrado no Player e coloque a primeira tela no ar.",
    to: "/telas?parear=1",
    icon: Monitor,
  },
] as const;

export function DashboardPage() {
  const { organization, profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [dashboard, deviceRows] = await Promise.all([
      supabase.rpc("get_screen_dashboard", {
        p_organization_id: organization.id,
      }),
      supabase
        .from("screens")
        .select(
          "id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision,screen_status(last_seen,current_media_id,current_playlist_id,player_version,screenshot_url,screenshot_at),screen_settings(layout_mode)",
        )
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (dashboard.error) setError(dashboard.error.message);
    else setData((dashboard.data || empty) as DashboardData);
    if (deviceRows.data) setScreens(deviceRows.data as unknown as Screen[]);
  }, [organization]);

  useEffect(() => {
    void load();
    if (!organization) return;
    const channel = supabase
      .channel(`dashboard:${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screen_status",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, organization]);

  const firstName = (profile?.full_name || "").split(" ")[0];
  const firstSetup = data.screensTotal === 0 || data.media === 0 || data.playlists === 0;

  return (
    <>
      <PageHead
        eyebrow="Visão geral"
        title={firstName ? `Olá, ${firstName}.` : "Visão geral"}
        text="O essencial para colocar suas telas no ar e acompanhar o que está funcionando."
        action="Conectar tela"
        onAction={() => navigate("/telas?parear=1")}
      />

      {error && <div className="form-message error">{error}</div>}

      <section className={firstSetup ? "dashboard-start dashboard-start-first" : "dashboard-start"}>
        <div className="dashboard-start-head">
          <div>
            <small>{firstSetup ? "COMECE POR AQUI" : "ACESSO RÁPIDO"}</small>
            <h2>{firstSetup ? "Sua primeira tela em poucos passos." : "O que você quer fazer agora?"}</h2>
            <p>{firstSetup ? "Siga esta ordem na primeira configuração. Depois, estes atalhos continuam disponíveis para o dia a dia." : "Acesse as tarefas mais usadas sem procurar pelo menu."}</p>
          </div>
          <Link className="dashboard-help-link" to="/ajuda"><HelpCircle /> Ver passo a passo</Link>
        </div>

        <div className="dashboard-quick-grid">
          {quickActions.map(({ step, title, text, to, icon: Icon }) => (
            <Link className="dashboard-quick-card" to={to} key={title}>
              <span className="dashboard-quick-icon"><Icon /></span>
              <span className="dashboard-quick-copy">
                <small>{firstSetup ? `PASSO ${step}` : "ATALHO"}</small>
                <b>{title}</b>
                <em>{text}</em>
              </span>
              <ArrowRight />
            </Link>
          ))}
        </div>
      </section>

      <div className="dashboard-compact-stats">
        <article>
          <span><Monitor /> Telas</span>
          <strong>{data.screensOnline}<small>/{data.screensTotal}</small></strong>
          <p>{data.screensTotal ? "online agora" : "nenhuma conectada"}</p>
        </article>
        <article>
          <span><Cloud /> Conteúdos</span>
          <strong>{data.media}</strong>
          <p>na biblioteca</p>
        </article>
        <article>
          <span><ListVideo /> Playlists</span>
          <strong>{data.playlists}</strong>
          <p>criadas</p>
        </article>
      </div>

      <section className="panel dashboard-screens-panel">
        <div className="panel-title">
          <div>
            <h2>Suas telas</h2>
            <p>Veja rapidamente quais Players estão conectados.</p>
          </div>
          <Link to="/telas">Gerenciar telas <ArrowRight size={14} /></Link>
        </div>

        {screens.length ? (
          <div className="dashboard-screen-list">
            {screens.map((screen) => {
              const raw = screen.screen_status;
              const status = (Array.isArray(raw) ? raw[0] : raw) || null;
              const online = Boolean(
                status?.last_seen &&
                  Date.now() - new Date(status.last_seen).getTime() < 90000,
              );
              const settingsRaw = screen.screen_settings;
              const settings = (
                Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw
              ) as { layout_mode?: string } | undefined;

              return (
                <Link className="screen-row dashboard-screen-row" to="/telas" key={screen.id}>
                  <span className="icon-box"><Monitor size={19} /></span>
                  <span>
                    <b>{screen.name}</b>
                    <small>
                      {settings?.layout_mode === "lframe" ? "Com informações" : "Tela cheia"} · {timeAgo(status?.last_seen)}
                    </small>
                  </span>
                  <em className={online ? "online" : "offline"}>
                    {online ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {online ? "Online" : "Offline"}
                  </em>
                  <ArrowRight className="screen-row-arrow" size={16} />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty-screen">
            <span className="icon-box"><Monitor size={20} /></span>
            <div>
              <b>Nenhuma tela conectada ainda</b>
              <small>Abra tv.pontoview.com.br na TV e use o código exibido.</small>
            </div>
            <Link className="btn primary" to="/telas?parear=1">Conectar tela</Link>
          </div>
        )}
      </section>
    </>
  );
}

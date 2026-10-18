import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  HelpCircle,
  ListVideo,
  Monitor,
  Wifi,
  WifiOff,
  Sparkles,
  CheckCircle2,
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
  { title: "Adicionar conteúdo", text: "Fotos, vídeos, YouTube e painéis prontos.", to: "/conteudo", icon: Cloud },
  { title: "Organizar programação", text: "Escolha o que será mostrado nas TVs.", to: "/playlists", icon: ListVideo },
  { title: "Minhas TVs", text: "Acompanhe e ajuste suas telas.", to: "/telas", icon: Monitor },
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
  const setupSteps = [
    { title: "Adicione o que deseja exibir", detail: "Comece com um painel pronto ou envie uma imagem.", done: data.media > 0, to: "/conteudo" },
    { title: "Monte sua programação", detail: "Organize o conteúdo em uma playlist.", done: data.playlists > 0, to: "/playlists" },
    { title: "Conecte sua TV", detail: "Digite o código mostrado no player.", done: data.screensTotal > 0, to: "/telas?parear=1" },
  ];
  const nextStep = setupSteps.find(step => !step.done);
  const completedSteps = setupSteps.filter(step => step.done).length;

  return (
    <>
      <PageHead
        eyebrow="Visão geral"
        title={firstName ? `Olá, ${firstName}.` : "Visão geral"}
        text={firstSetup ? "Vamos colocar sua primeira TV no ar, sem complicação." : "Veja suas TVs e altere o que está passando."}
        action="Conectar tela"
        onAction={() => navigate("/telas?parear=1")}
      />

      {error && <div className="form-message error">{error}</div>}

      {firstSetup ? (
        <section className="pv-welcome panel" aria-label="Primeiros passos">
          <div className="pv-welcome-intro">
            <span className="pv-welcome-symbol"><Sparkles size={26} /></span>
            <div><small>PRIMEIROS PASSOS · {completedSteps} DE 3 CONCLUÍDOS</small>
              <h2>Sua primeira TV, passo a passo.</h2>
              <p>Uma coisa de cada vez. Você pode voltar e mudar tudo depois.</p>
            </div>
          </div>
          <div className="pv-steps">
            {setupSteps.map((step, index) => (
              <Link key={step.title} className={`pv-step ${step.done ? "is-done" : ""} ${nextStep === step ? "is-next" : ""}`} to={step.to}>
                <span className="pv-step-number">{step.done ? <CheckCircle2 size={20} /> : index + 1}</span>
                <span className="pv-step-copy"><strong>{step.title}</strong><small>{step.done ? "Concluído" : step.detail}</small></span>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
          {nextStep && <Link className="btn primary pv-next" to={nextStep.to}>Continuar: {nextStep.title} <ArrowRight size={18} /></Link>}
          <Link className="pv-help" to="/ajuda"><HelpCircle size={16} /> Precisa de ajuda?</Link>
        </section>
      ) : (
        <section className="pv-welcome panel">
          <div className="pv-welcome-intro">
            <span className="pv-welcome-symbol"><Monitor size={26} /></span>
            <div><small>SUAS TRANSMISSÕES</small><h2>{data.screensOnline} de {data.screensTotal} TVs online</h2>
              <p>{data.screensOnline === data.screensTotal ? "Suas telas estão conectadas." : "Há uma TV que pode precisar de atenção."}</p>
            </div>
            <Link className="btn primary" to="/telas">Ver minhas TVs <ArrowRight size={18} /></Link>
          </div>
        </section>
      )}

      <section className="pv-actions" aria-label="Ações rápidas">
        <div className="pv-actions-title"><h2>O que você quer fazer?</h2><p>Acesse diretamente as tarefas mais importantes.</p></div>
        <div className="pv-action-grid">
          {quickActions.map(({ title, text, to, icon: Icon }) => (
            <Link to={to} className="pv-action-card" key={title}>
              <span className="pv-action-icon"><Icon size={25} /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>

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

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  Images,
  ListVideo,
  Monitor,
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
  { title: "Novo conteúdo", to: "/conteudo", icon: Images, tone: "content" },
  { title: "Criar playlist", to: "/playlists", icon: ListVideo, tone: "playlist" },
  { title: "Conectar TV", to: "/telas?parear=1", icon: Monitor, tone: "screen" },
  { title: "Google Drive", to: "/empresa#google-drive", icon: Cloud, tone: "drive" },
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
  const actions = firstSetup ? [quickActions[2], quickActions[0], quickActions[1], quickActions[3]] : quickActions;

  return (
    <>

      <style>{`
        .pv-dash-overview,.pv-dash-actions{margin-bottom:20px}
        .pv-dash-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
        .pv-dash-section-title small{display:block;font-size:10px;letter-spacing:.12em;font-weight:800;color:#64809a;margin-bottom:4px}
        .pv-dash-section-title h2{margin:0;font-size:19px;line-height:1.25;letter-spacing:-.025em;color:#19314b}
        .pv-dash-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .pv-dash-stat{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;min-height:116px;padding:15px;background:#fff;border:1px solid #dce6f1;border-radius:16px;text-decoration:none;color:#18324c;transition:border-color .18s,transform .18s}
        .pv-dash-stat:hover,.pv-dash-action:hover{border-color:#97b9e9;transform:translateY(-2px)}
        .pv-dash-stat>svg{width:20px;height:20px;color:#347bca;margin-bottom:4px}
        .pv-dash-stat strong{font-size:27px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}
        .pv-dash-stat span{font-size:12px;color:#687d92;font-weight:600}
        .pv-dash-actions{padding:17px;border:1px solid #dce6f1;background:#f7faff;border-radius:20px}
        .pv-dash-help{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;text-decoration:none;font-weight:700;font-size:12px;color:#306bac}
        .pv-dash-action-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .pv-dash-action{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:12px;min-width:0;min-height:105px;padding:15px;background:#fff;border:1px solid #e0e9f3;border-radius:15px;color:#223b55;text-decoration:none;transition:border-color .18s,transform .18s}
        .pv-dash-action strong{font-size:13px;line-height:1.25;font-weight:750;overflow-wrap:anywhere}
        .pv-dash-action-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#e8f4ff;color:#1384ca}
        .pv-dash-action-icon svg{width:21px;height:21px}
        .pv-dash-action--playlist .pv-dash-action-icon{background:#f0eaff;color:#8050d2}
        .pv-dash-action--screen .pv-dash-action-icon{background:#e6f7ee;color:#178f5b}
        .pv-dash-action--drive .pv-dash-action-icon{background:#e8efff;color:#2565cd}
        .dashboard-screen-row .pv-dash-last-seen{font-size:11px;color:#698098;font-style:normal;white-space:nowrap}
        @media(max-width:760px){
          .pv-dash-overview,.pv-dash-actions{margin-bottom:16px}
          .pv-dash-section-title h2{font-size:16px}
          .pv-dash-stat-grid{gap:8px}
          .pv-dash-stat{min-height:99px;padding:12px;border-radius:13px}
          .pv-dash-stat strong{font-size:23px}
          .pv-dash-stat span{font-size:11px}
          .pv-dash-actions{padding:13px;border-radius:17px}
          .pv-dash-action-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
          .pv-dash-action{min-height:94px;padding:13px;gap:9px}
          .pv-dash-action strong{font-size:12px}
          .pv-dash-overview{margin-top:0}
          .pv-dash-section-title{margin-bottom:10px}
          .pv-dash-actions{background:#f8fbff}
          .pv-dash-stat{box-shadow:none}
          .pv-dash-stat-grid,.pv-dash-action-grid{width:100%;max-width:100%}
          .pv-dash-action{box-shadow:none;min-width:0}
          .pv-dash-help{font-size:11px}
          .dashboard-screens-panel{margin-top:4px}
          .dashboard-screen-row .pv-dash-last-seen{display:none}
        }
        @media(max-width:380px){.pv-dash-stat{padding:10px}.pv-dash-stat span{font-size:10px}.pv-dash-action{padding:11px}}
        @media(prefers-reduced-motion:reduce){.pv-dash-stat,.pv-dash-action{transition:none}}
      `}</style>
      <PageHead
        eyebrow="Visão geral"
        title={firstName ? `Olá, ${firstName}.` : "Visão geral"}
        text="O essencial para colocar suas telas no ar e acompanhar o que está funcionando."
        action="Conectar tela"
        onAction={() => navigate("/telas?parear=1")}
      />

      {error && <div className="form-message error">{error}</div>}

      <div className="pv-dash-overview">
        <div className="pv-dash-section-title">
          <div><small>RESUMO DA CONTA</small><h2>Seu espaço de trabalho</h2></div>
        </div>
        <div className="pv-dash-stat-grid">
          <Link to="/telas" className="pv-dash-stat">
            <Monitor aria-hidden="true" />
            <strong>{data.screensTotal}</strong>
            <span>Telas</span>
          </Link>
          <Link to="/conteudo" className="pv-dash-stat">
            <Images aria-hidden="true" />
            <strong>{data.media}</strong>
            <span>Conteúdos</span>
          </Link>
          <Link to="/playlists" className="pv-dash-stat">
            <ListVideo aria-hidden="true" />
            <strong>{data.playlists}</strong>
            <span>Playlists</span>
          </Link>
        </div>
      </div>

      <section className="pv-dash-actions" aria-labelledby="pv-dash-actions-title">
        <div className="pv-dash-section-title">
          <div><small>ACESSO RÁPIDO</small><h2 id="pv-dash-actions-title">O que deseja fazer?</h2></div>
          <Link to="/ajuda" className="pv-dash-help">Ajuda <ArrowRight size={14} /></Link>
        </div>
        <div className="pv-dash-action-grid">
          {actions.map(({ title, to, icon: Icon, tone }) => (
            <Link className={`pv-dash-action pv-dash-action--${tone}`} to={to} key={title}>
              <span className="pv-dash-action-icon"><Icon aria-hidden="true" /></span>
              <strong>{title}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel dashboard-screens-panel">
        <div className="panel-title">
          <div>
            <h2>Suas telas</h2>
            <p>Última comunicação registrada de cada tela.</p>
          </div>
          <Link to="/telas">Gerenciar telas <ArrowRight size={14} /></Link>
        </div>

        {screens.length ? (
          <div className="dashboard-screen-list">
            {screens.map((screen) => {
              const raw = screen.screen_status;
              const status = (Array.isArray(raw) ? raw[0] : raw) || null;
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
                  <em className="pv-dash-last-seen">{status?.last_seen ? "Última comunicação" : "Sem registro"}</em>
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

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Cloud,
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
  const statCards = [
    [
      "Telas online",
      data.screensOnline,
      `de ${data.screensTotal} telas`,
      Monitor,
    ],
    ["Conteúdos", data.media, "na biblioteca", Cloud],
    ["Playlists", data.playlists, "organizadas", ListVideo],
    ["Programações", data.activeSchedules, "ativas agora", CalendarClock],
  ] as const;
  return (
    <>
      <PageHead
        eyebrow="Visão geral"
        title={firstName ? `Olá, ${firstName}.` : "Visão geral"}
        text="Acompanhe suas telas, conteúdos e programações em um só lugar."
        action="Conectar tela"
        onAction={() => navigate("/telas?parear=1")}
      />
      {error && <div className="form-message error">{error}</div>}
      <div className="stats">
        {statCards.map(([label, value, meta, Icon]) => (
          <article key={label}>
            <Icon size={19} />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{meta}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Telas</h2>
              <p>Status em tempo real dos Players</p>
            </div>
            <Link to="/telas">Ver todas</Link>
          </div>
          {screens.length ? (
            screens.map((screen) => {
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
                <div className="screen-row" key={screen.id}>
                  <span className="icon-box">
                    <Monitor size={19} />
                  </span>
                  <span>
                    <b>{screen.name}</b>
                    <small>
                      {settings?.layout_mode === "lframe"
                        ? "Moldura em L"
                        : "Tela cheia"}{" "}
                      · {timeAgo(status?.last_seen)}
                    </small>
                  </span>
                  <em className={online ? "online" : "offline"}>
                    {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
                    {online ? "Online" : "Offline"}
                  </em>
                </div>
              );
            })
          ) : (
            <div className="compact-empty">
              <Monitor />
              <span>
                <b>Nenhuma tela conectada</b>
                <small>Abra o Player em uma TV para começar.</small>
              </span>
            </div>
          )}
        </section>
        <section className="panel activity">
          <div className="panel-title">
            <div>
              <h2>Atividade recente</h2>
              <p>Eventos enviados pelos Players</p>
            </div>
          </div>
          <div className="timeline">
            {data.recentEvents.length ? (
              data.recentEvents.map((event) => (
                <span key={event.id}>
                  <i />
                  <b>{eventLabel(event.event_type)}</b>
                  <small>{timeAgo(event.occurred_at)}</small>
                </span>
              ))
            ) : (
              <div className="compact-empty">
                <ListVideo />
                <span>
                  <b>Aguardando atividade</b>
                  <small>
                    Os eventos aparecerão após a primeira tela entrar no ar.
                  </small>
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function eventLabel(type: string) {
  return (
    (
      {
        player_online: "Player conectado",
        player_offline: "Player ficou offline",
        content_started: "Conteúdo iniciado",
        content_ended: "Conteúdo concluído",
        media_error: "Erro de mídia registrado",
        sync: "Playlist sincronizada",
        paired: "Nova tela pareada",
      } as Record<string, string>
    )[type] || "Atividade do Player"
  );
}

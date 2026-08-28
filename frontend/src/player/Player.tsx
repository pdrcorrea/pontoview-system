import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  CloudSun,
  Loader2,
  Monitor,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import {
  functionsUrl,
  supabase,
  supabasePublishableKey,
} from "../lib/supabase";
import type { PlayerManifest } from "../types";

const PLAYER_VERSION = "1.0.0";
const DEVICE_KEY = "pontoview_player_device_v1";
type Device = { screenId: string; token: string };

export function PlayerPage() {
  const params = useParams();
  const [device, setDevice] = useState<Device | null>(() => readDevice());
  const [activation, setActivation] = useState<{
    id: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [index, setIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const activationStarted = useRef(false);
  const routeScreenId = params.screenId;
  const activeDevice =
    device && (!routeScreenId || routeScreenId === device.screenId)
      ? device
      : null;
  const startActivation = useCallback(async () => {
    if (activationStarted.current) return;
    activationStarted.current = true;
    const result = await supabase.rpc("create_screen_activation");
    if (result.error) {
      setError(result.error.message);
      activationStarted.current = false;
      return;
    }
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    setActivation({
      id: row.activation_id,
      code: row.activation_code,
      expiresAt: row.expires_at,
    });
  }, []);
  useEffect(() => {
    if (!activeDevice) void startActivation();
  }, [activeDevice, startActivation]);
  useEffect(() => {
    if (!activation) return;
    const poll = window.setInterval(async () => {
      const result = await supabase.rpc("check_screen_activation", {
        p_activation_id: activation.id,
      });
      if (result.error) return;
      const state = result.data as {
        status: string;
        screenId?: string;
        deviceToken?: string;
      };
      if (state.status === "claimed" && state.screenId && state.deviceToken) {
        const next = { screenId: state.screenId, token: state.deviceToken };
        localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
        setDevice(next);
        setActivation(null);
        window.clearInterval(poll);
      }
      if (state.status === "expired") {
        setActivation(null);
        activationStarted.current = false;
        void startActivation();
      }
    }, 2000);
    return () => window.clearInterval(poll);
  }, [activation, startActivation]);
  const sync = useCallback(
    async (silent = false) => {
      if (!activeDevice) return;
      const result = await supabase.rpc("get_player_manifest", {
        p_screen_id: activeDevice.screenId,
        p_token: activeDevice.token,
      });
      if (result.error) {
        const cached = readManifest(activeDevice.screenId);
        if (cached) {
          setManifest(cached);
          setConnected(false);
        } else if (!silent)
          setError("Não foi possível sincronizar este Player.");
        if (result.error.message.includes("INVALID_DEVICE_TOKEN")) {
          localStorage.removeItem(DEVICE_KEY);
          setDevice(null);
          activationStarted.current = false;
        }
        return;
      }
      const next = result.data as PlayerManifest;
      if (next.settings?.widgets?.news) {
        try {
          const news = await fetch(`${functionsUrl}/screens-news`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabasePublishableKey || "",
              "x-screen-id": activeDevice.screenId,
              "x-screen-token": activeDevice.token,
            },
            body: "{}",
          }).then((r) => (r.ok ? r.json() : null));
          if (news?.items) next.news = news.items;
        } catch {}
      }
      localStorage.setItem(
        `pv_manifest_${activeDevice.screenId}`,
        JSON.stringify(next),
      );
      setManifest(next);
      setConnected(true);
      setError(null);
      setIndex((current) =>
        Math.min(current, Math.max(0, next.items.length - 1)),
      );
    },
    [activeDevice],
  );
  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(true), 15000);
    const online = () => {
      setConnected(true);
      void sync(true);
    };
    const offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [sync]);
  const item = manifest?.items[index] || null;
  useEffect(() => {
    if (!activeDevice || !manifest) return;
    const heartbeat = () =>
      void supabase.rpc("player_heartbeat", {
        p_screen_id: activeDevice.screenId,
        p_token: activeDevice.token,
        p_media_id: item?.media.id || null,
        p_playlist_id: manifest.playlist?.id || null,
        p_player_version: PLAYER_VERSION,
        p_client_info: {
          userAgent: navigator.userAgent,
          viewport: `${innerWidth}x${innerHeight}`,
          online: navigator.onLine,
        },
      });
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [activeDevice, manifest, item?.media.id]);
  useEffect(() => {
    if (!activeDevice || !manifest || !item) return;
    void supabase.rpc("player_event", {
      p_screen_id: activeDevice.screenId,
      p_token: activeDevice.token,
      p_event_type: "content_started",
      p_media_id: item.media.id,
      p_playlist_id: manifest.playlist?.id || null,
      p_payload: { position: index },
    });
  }, [activeDevice, manifest?.playlist?.id, item?.itemId, index]);
  const advance = useCallback(
    (failed = false, detail?: string) => {
      if (!manifest || !activeDevice || !item) return;
      void supabase.rpc("player_event", {
        p_screen_id: activeDevice.screenId,
        p_token: activeDevice.token,
        p_event_type: failed ? "media_error" : "content_ended",
        p_media_id: item.media.id,
        p_playlist_id: manifest.playlist?.id || null,
        p_payload: failed
          ? { detail: detail || "playback_error" }
          : { position: index },
      });
      setIndex((current) => (current + 1) % Math.max(1, manifest.items.length));
    },
    [manifest, activeDevice, item, index],
  );
  const handleEnd = useCallback(() => advance(false), [advance]);
  const handleError = useCallback(
    (detail: string) => advance(true, detail),
    [advance],
  );
  useEffect(() => {
    if (item?.media.onlineRequired && !navigator.onLine) {
      const timer = window.setTimeout(
        () => advance(true, "offline_content_skipped"),
        500,
      );
      return () => window.clearTimeout(timer);
    }
  }, [item?.itemId, advance]);
  if (!activeDevice)
    return (
      <ActivationView
        activation={activation}
        error={error}
        onRetry={() => {
          setError(null);
          activationStarted.current = false;
          void startActivation();
        }}
      />
    );
  if (!manifest)
    return (
      <div className="player-boot">
        <span className="player-mark">P</span>
        <Loader2 className="spin" />
        <p>Sincronizando conteúdo…</p>
        {error && <small>{error}</small>}
      </div>
    );
  return (
    <div
      className={`pv-player-runtime ${manifest.screen.orientation === "portrait" ? "portrait" : ""}`}
    >
      <div className={`connection-dot ${connected ? "" : "offline"}`}>
        {connected ? (
          ""
        ) : (
          <>
            <WifiOff /> Conteúdo offline
          </>
        )}
      </div>
      <PlayerLayout
        manifest={manifest}
        item={item}
        device={activeDevice}
        onEnd={handleEnd}
        onError={handleError}
      />
    </div>
  );
}

function ActivationView({
  activation,
  error,
  onRetry,
}: {
  activation: { code: string; expiresAt: string } | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="activation-screen">
      <div className="activation-brand">
        <span className="player-mark">P</span>
        <b>PontoView Player</b>
      </div>
      <section>
        <Monitor />
        <small>CONECTAR ESTA TELA</small>
        <h1>{activation?.code || "••••••"}</h1>
        <p>
          No painel PontoView, acesse <b>Telas → Conectar tela</b> e informe
          este código.
        </p>
        {activation && (
          <em>O código é temporário e será renovado automaticamente.</em>
        )}
        {error && (
          <div className="activation-error">
            {error}
            <button onClick={onRetry}>
              <RefreshCw />
              Tentar novamente
            </button>
          </div>
        )}
      </section>
      <footer>pontoview.com.br</footer>
    </div>
  );
}

function PlayerLayout({
  manifest,
  item,
  device,
  onEnd,
  onError,
}: {
  manifest: PlayerManifest;
  item: PlayerManifest["items"][number] | null;
  device: Device;
  onEnd: () => void;
  onError: (detail: string) => void;
}) {
  const settings = manifest.settings;
  const [clock, setClock] = useState(new Date());
  const [infoIndex, setInfoIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const info = useMemo(
    () =>
      [
        ...manifest.news.map((n) => n.title),
        ...manifest.messages.map((m) => m.body),
      ].filter(Boolean),
    [manifest.news, manifest.messages],
  );
  useEffect(() => {
    if (!info.length) return;
    const timer = window.setInterval(
      () => setInfoIndex((i) => (i + 1) % info.length),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [info.length]);
  const stage = (
    <MediaStage
      item={item}
      device={device}
      organization={manifest.organization}
      onEnd={onEnd}
      onError={onError}
    />
  );
  if (settings.layout_mode !== "lframe")
    return <main className="player-fullscreen">{stage}</main>;
  return (
    <main
      className={`player-lframe side-${settings.side_position} bar-${settings.bar_position}`}
    >
      <div className="player-main">{stage}</div>
      <aside>
        {settings.widgets?.clock && (
          <div className="live-clock">
            <b>
              {clock.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
            {settings.widgets?.date && (
              <small>
                {clock
                  .toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })
                  .toUpperCase()}
              </small>
            )}
          </div>
        )}
        {settings.widgets?.weather && (
          <WeatherWidget screenId={device.screenId} token={device.token} />
        )}{" "}
        {settings.widgets?.business && (
          <div className="live-business">
            <Building2 />
            <span>{manifest.organization.displayName}</span>
          </div>
        )}
      </aside>
      <footer>
        {info.length ? (
          <>
            <b>
              {manifest.messages.some((m) => m.body === info[infoIndex])
                ? "AVISO"
                : "AGORA"}
            </b>
            <span key={infoIndex}>{info[infoIndex]}</span>
          </>
        ) : (
          <span>{manifest.organization.displayName}</span>
        )}
      </footer>
    </main>
  );
}

function MediaStage({
  item,
  device,
  organization,
  onEnd,
  onError,
}: {
  item: PlayerManifest["items"][number] | null;
  device: Device;
  organization: PlayerManifest["organization"];
  onEnd: () => void;
  onError: (detail: string) => void;
}) {
  if (!item)
    return (
      <div className="player-standby">
        <span className="player-mark">P</span>
        <h1>{organization.displayName}</h1>
        <p>Aguardando conteúdo na playlist.</p>
      </div>
    );
  const media = item.media;
  const duration = item.durationSeconds || media.durationSeconds || 15;
  if (media.type === "youtube" && media.youtubeVideoId)
    return (
      <YouTubeStage
        videoId={media.youtubeVideoId}
        options={media.youtubeOptions}
        onEnd={onEnd}
        onError={onError}
      />
    );
  if (media.type === "drive_image" || media.type === "drive_video")
    return (
      <DriveStage
        media={media}
        duration={duration}
        device={device}
        onEnd={onEnd}
        onError={onError}
      />
    );
  if (media.type === "webpage" && media.pageUrl)
    return (
      <TimedStage seconds={duration} onEnd={onEnd}>
        <iframe
          src={media.pageUrl}
          title={media.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onError={() => onError("webpage_load_error")}
        />
      </TimedStage>
    );
  if (media.type === "message")
    return (
      <TimedStage seconds={duration} onEnd={onEnd}>
        <div className="message-stage">
          <small>COMUNICADO</small>
          <h1>{String(media.messageContent?.title || media.name)}</h1>
          <p>{String(media.messageContent?.body || "")}</p>
        </div>
      </TimedStage>
    );
  if (media.type === "app")
    return (
      <TimedStage seconds={duration} onEnd={onEnd}>
        <AppStage
          appKey={media.appKey}
          name={media.name}
          organization={organization}
        />
      </TimedStage>
    );
  return (
    <TimedStage seconds={duration} onEnd={onEnd}>
      <div className="player-standby">
        <h1>{media.name}</h1>
      </div>
    </TimedStage>
  );
}

function TimedStage({
  seconds,
  onEnd,
  children,
}: {
  seconds: number;
  onEnd: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onEnd, Math.max(1, seconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, onEnd]);
  return <div className="timed-stage">{children}</div>;
}

function DriveStage({
  media,
  duration,
  device,
  onEnd,
  onError,
}: {
  media: PlayerManifest["items"][number]["media"];
  duration: number;
  device: Device;
  onEnd: () => void;
  onError: (d: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void loadDriveAsset(media, device)
      .then((value) => {
        objectUrl = value;
        if (active) setUrl(value);
      })
      .catch(() => active && onError("drive_fetch_error"));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.id, media.driveChecksum, device.screenId, device.token, onError]);
  if (!url)
    return (
      <div className="player-loading">
        <Loader2 className="spin" />
        <small>Preparando {media.name}</small>
      </div>
    );
  if (media.type === "drive_video")
    return (
      <video
        src={url}
        autoPlay
        playsInline
        onEnded={onEnd}
        onError={() => onError("drive_video_error")}
      />
    );
  return (
    <TimedStage seconds={duration} onEnd={onEnd}>
      <img src={url} alt="" onError={() => onError("drive_image_error")} />
    </TimedStage>
  );
}

async function loadDriveAsset(
  media: PlayerManifest["items"][number]["media"],
  device: Device,
) {
  const cache = await caches.open("pontoview-media-v1");
  const key = new Request(
    `${location.origin}/__pv_cache/${device.screenId}/${media.id}/${media.driveChecksum || "latest"}`,
  );
  const cached = await cache.match(key);
  if (cached) return URL.createObjectURL(await cached.blob());
  if (!navigator.onLine) throw new Error("offline");
  const response = await fetch(`${functionsUrl}/drive-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabasePublishableKey || "",
      "x-screen-id": device.screenId,
      "x-screen-token": device.token,
    },
    body: JSON.stringify({ mediaId: media.id }),
  });
  if (!response.ok) throw new Error("drive_media_error");
  await cache.put(key, response.clone());
  return URL.createObjectURL(await response.blob());
}

function YouTubeStage({
  videoId,
  options,
  onEnd,
  onError,
}: {
  videoId: string;
  options: Record<string, unknown>;
  onEnd: () => void;
  onError: (d: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  useEffect(() => {
    let active = true;
    loadYouTubeApi()
      .then(() => {
        if (!active || !host.current) return;
        player.current = new window.YT.Player(host.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: options.controls ? 1 : 0,
            mute: options.mute ? 1 : 0,
            start: Number(options.start || 0),
            end: options.end ? Number(options.end) : undefined,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(Number(options.volume ?? 100));
              if (options.mute) event.target.mute();
              event.target.playVideo();
            },
            onStateChange: (event: any) => {
              if (event.data === 0) onEnd();
            },
            onError: (event: any) => onError(`youtube_${event.data}`),
          },
        });
      })
      .catch(() => onError("youtube_api_error"));
    return () => {
      active = false;
      player.current?.destroy?.();
    };
  }, [videoId, onEnd, onError, options]);
  return <div className="youtube-stage" ref={host} />;
}

let youtubePromise: Promise<void> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubePromise) return youtubePromise;
  youtubePromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("youtube"));
    document.head.appendChild(script);
  });
  return youtubePromise;
}

function AppStage({
  appKey,
  name,
  organization,
}: {
  appKey: string | null;
  name: string;
  organization: PlayerManifest["organization"];
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (appKey === "clock")
    return (
      <div className="clock-app">
        <b>
          {now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </b>
        <span>
          {now.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
    );
  return (
    <div className="generic-app">
      <span className="player-mark">P</span>
      <small>APP PONTOVIEW</small>
      <h1>{name}</h1>
      <p>{organization.displayName}</p>
    </div>
  );
}

function WeatherWidget({
  screenId,
  token,
}: {
  screenId: string;
  token: string;
}) {
  const [data, setData] = useState<{
    temperature: number | null;
    name?: string;
  } | null>(null);
  useEffect(() => {
    void fetch(`${functionsUrl}/screens-weather`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabasePublishableKey || "",
        "x-screen-id": screenId,
        "x-screen-token": token,
      },
      body: "{}",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => result && setData(result));
  }, [screenId, token]);
  return (
    <div className="live-weather">
      <CloudSun />
      <span>
        <b>
          {data?.temperature != null ? `${Math.round(data.temperature)}°` : "—"}
        </b>
        <small>{data?.name || "Clima"}</small>
      </span>
    </div>
  );
}

function readDevice(): Device | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
    return value?.screenId && value?.token ? value : null;
  } catch {
    return null;
  }
}
function readManifest(id: string): PlayerManifest | null {
  try {
    return JSON.parse(localStorage.getItem(`pv_manifest_${id}`) || "null");
  } catch {
    return null;
  }
}

interface YTPlayer {
  destroy?: () => void;
}
declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Loader2,
  Monitor,
  Newspaper,
  RefreshCw,
  Snowflake,
  Sun,
  WifiOff,
  Wind,
} from "lucide-react";
import { isWithinOperatingHours } from "../lib/operatingHours";
import { functionsUrl, supabase, supabasePublishableKey } from "../lib/supabase";
import type { PlayerManifest } from "../types";

const PLAYER_VERSION = "1.2.0";
const DEVICE_KEY = "pontoview_player_device_v1";
const NEWS_REFRESH_MS = 5 * 60_000;
const PLAYER_RUNTIME_STYLE = `
  .pv-stage-transition {
    width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: #000;
    animation: pv-stage-in 560ms cubic-bezier(.22,.61,.36,1) both;
    will-change: opacity, transform;
  }
  .pv-stage-transition.cut { animation: none; }
  @keyframes pv-stage-in { from { opacity: 0; transform: scale(1.006); } to { opacity: 1; transform: scale(1); } }
  .pv-player-power-off { position: fixed; inset: 0; z-index: 99999; width: 100vw; height: 100vh; background: #000; cursor: none; }
  .pv-brand-official { width: 100%; height: 100%; object-fit: contain; display: block; }
  .pv-brand-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: .7em; letter-spacing: -.04em; }
  .live-weather { display: block; }
  .weather-current { display: flex; align-items: center; gap: 1vw; }
  .weather-current > svg { width: clamp(30px,3vw,58px); height: auto; flex: 0 0 auto; }
  .live-weather small.condition { opacity: .8; }
  .live-weather .weather-detail { display: flex; gap: .7em; margin-top: .25em; font-size: clamp(8px,.72vw,13px); color: #61768a; }
  .live-weather .weather-detail svg { width: 1em; height: 1em; }
  .weather-forecast { margin-top: 2.2vh; border-top: 1px solid #d6e0e7; padding-top: 1.7vh; display: grid; gap: 1.15vh; }
  .weather-day { display: grid !important; grid-template-columns: minmax(42px,.75fr) 26px 1fr; align-items: center; gap: .55vw; color: #40586d; }
  .weather-day > small { font-size: clamp(8px,.74vw,13px); font-weight: 700; color: #40586d; text-transform: uppercase; letter-spacing: .04em; }
  .weather-day > svg { width: clamp(17px,1.45vw,28px); height: auto; color: #244f7e; }
  .weather-day > span { display: flex; justify-content: flex-end; gap: .45em; font-size: clamp(9px,.82vw,15px); white-space: nowrap; }
  .weather-day .min { color: #6a8295; }
  .player-lframe > footer .news-source { display: inline-flex; align-items: center; gap: .55em; flex: 0 0 auto; animation: none; }
  .news-source-icon { position: relative; width: 1.7em; height: 1.7em; border-radius: .38em; background: #edf3f7; display: grid !important; place-items: center; overflow: hidden; }
  .news-source-icon svg { width: 56%; height: 56%; color: #244f7e; }
  .news-source-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .news-source strong { font-size: .72em; color: #244f7e; max-width: 14em; overflow: hidden; text-overflow: ellipsis; }
  .footer-headline { overflow: hidden; text-overflow: ellipsis; }
  .footer-company { display: flex !important; align-items: center; height: 70%; gap: .7em; animation: none !important; }
  .footer-company img { max-height: 100%; max-width: min(28vw,320px); object-fit: contain; }
  .footer-company svg { width: 1.25em; height: 1.25em; color: #244f7e; }
  .footer-company strong { font-size: .85em; color: #244f7e; }
  @media (orientation: portrait) {
    .weather-forecast { gap: .75vh; }
    .weather-day { grid-template-columns: minmax(36px,.8fr) 22px 1fr; }
    .news-source strong { max-width: 8em; }
  }
  @media (prefers-reduced-motion: reduce) { .pv-stage-transition { animation-duration: 1ms; } }
`;

type Device = { screenId: string; token: string };
type ManifestItem = PlayerManifest["items"][number];

export function PlayerPage() {
  const params = useParams();
  const [device, setDevice] = useState<Device | null>(() => readDevice());
  const [activation, setActivation] = useState<{ id: string; code: string; expiresAt: string } | null>(null);
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [index, setIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [runtimeNow, setRuntimeNow] = useState(new Date());
  const activationStarted = useRef(false);
  const newsFetch = useRef<{ key: string; at: number; items: PlayerManifest["news"] }>({ key: "", at: 0, items: [] });
  const routeScreenId = params.screenId;
  const activeDevice = device && (!routeScreenId || routeScreenId === device.screenId) ? device : null;

  useEffect(() => {
    const timer = window.setInterval(() => setRuntimeNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

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
    setActivation({ id: row.activation_id, code: row.activation_code, expiresAt: row.expires_at });
  }, []);

  useEffect(() => { if (!activeDevice) void startActivation(); }, [activeDevice, startActivation]);

  useEffect(() => {
    if (!activation) return;
    const poll = window.setInterval(async () => {
      const result = await supabase.rpc("check_screen_activation", { p_activation_id: activation.id });
      if (result.error) return;
      const state = result.data as { status: string; screenId?: string; deviceToken?: string };
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

  const sync = useCallback(async (silent = false) => {
    if (!activeDevice) return;
    const result = await supabase.rpc("get_player_manifest", {
      p_screen_id: activeDevice.screenId,
      p_token: activeDevice.token,
    });
    if (result.error) {
      const cached = readManifest(activeDevice.screenId);
      if (cached) { setManifest(cached); setConnected(false); }
      else if (!silent) setError("Não foi possível sincronizar este Player.");
      if (result.error.message.includes("INVALID_DEVICE_TOKEN")) {
        localStorage.removeItem(DEVICE_KEY);
        setDevice(null);
        activationStarted.current = false;
      }
      return;
    }

    const next = result.data as PlayerManifest;
    if (next.settings?.widgets?.news) {
      const categories = (next.settings.news_categories || ["general"]).join(",");
      const shouldRefresh = newsFetch.current.key !== categories || Date.now() - newsFetch.current.at >= NEWS_REFRESH_MS || !newsFetch.current.items.length;
      if (shouldRefresh) {
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
          }).then((response) => response.ok ? response.json() : null);
          if (Array.isArray(news?.items) && news.items.length) {
            newsFetch.current = { key: categories, at: Date.now(), items: news.items };
          } else {
            newsFetch.current = { ...newsFetch.current, key: categories, at: Date.now() };
          }
        } catch {
          newsFetch.current = { ...newsFetch.current, key: categories, at: Date.now() };
        }
      }
      if (newsFetch.current.items.length) next.news = newsFetch.current.items;
    } else {
      next.news = [];
    }

    localStorage.setItem(`pv_manifest_${activeDevice.screenId}`, JSON.stringify(next));
    setManifest(next);
    setConnected(true);
    setError(null);
    setIndex((current) => Math.min(current, Math.max(0, next.items.length - 1)));
  }, [activeDevice]);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(true), 15000);
    const online = () => { setConnected(true); void sync(true); };
    const offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [sync]);

  const operating = manifest
    ? isWithinOperatingHours(manifest.settings?.operating_hours, manifest.organization.timezone, runtimeNow)
    : true;
  const item = operating ? manifest?.items[index] || null : null;
  const playbackRef = useRef<{ manifest: PlayerManifest | null; item: ManifestItem | null; index: number }>({ manifest: null, item: null, index: 0 });

  useEffect(() => { playbackRef.current = { manifest, item, index }; }, [manifest, item, index]);

  useEffect(() => {
    if (!activeDevice || !manifest) return;
    const heartbeat = () => void supabase.rpc("player_heartbeat", {
      p_screen_id: activeDevice.screenId,
      p_token: activeDevice.token,
      p_media_id: operating ? item?.media.id || null : null,
      p_playlist_id: operating ? manifest.playlist?.id || null : null,
      p_player_version: PLAYER_VERSION,
      p_client_info: {
        userAgent: navigator.userAgent,
        viewport: `${innerWidth}x${innerHeight}`,
        online: navigator.onLine,
        orientation: manifest.screen.orientation,
        operating,
      },
    });
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [activeDevice, manifest?.playlist?.id, manifest?.screen.orientation, operating, item?.media.id]);

  useEffect(() => {
    if (!operating || !activeDevice || !manifest || !item) return;
    void supabase.rpc("player_event", {
      p_screen_id: activeDevice.screenId,
      p_token: activeDevice.token,
      p_event_type: "content_started",
      p_media_id: item.media.id,
      p_playlist_id: manifest.playlist?.id || null,
      p_payload: { position: index },
    });
  }, [operating, activeDevice, manifest?.playlist?.id, item?.itemId, index]);

  const advance = useCallback((failed = false, detail?: string) => {
    const current = playbackRef.current;
    if (!current.manifest || !activeDevice || !current.item) return;
    void supabase.rpc("player_event", {
      p_screen_id: activeDevice.screenId,
      p_token: activeDevice.token,
      p_event_type: failed ? "media_error" : "content_ended",
      p_media_id: current.item.media.id,
      p_playlist_id: current.manifest.playlist?.id || null,
      p_payload: failed ? { detail: detail || "playback_error" } : { position: current.index },
    });
    const itemCount = Math.max(1, current.manifest.items.length);
    setIndex((position) => (position + 1) % itemCount);
  }, [activeDevice]);

  const handleEnd = useCallback(() => advance(false), [advance]);
  const handleError = useCallback((detail: string) => advance(true, detail), [advance]);

  useEffect(() => {
    if (!operating) return;
    if (item?.media.onlineRequired && !navigator.onLine) {
      const timer = window.setTimeout(() => advance(true, "offline_content_skipped"), 500);
      return () => window.clearTimeout(timer);
    }
  }, [operating, item?.itemId, advance]);

  if (!activeDevice) return <ActivationView activation={activation} error={error} onRetry={() => { setError(null); activationStarted.current = false; void startActivation(); }} />;
  if (!manifest) return (
    <div className="player-boot"><span className="player-mark"><BrandMark /></span><Loader2 className="spin" /><p>Sincronizando conteúdo…</p>{error && <small>{error}</small>}</div>
  );

  if (!operating) return <><style>{PLAYER_RUNTIME_STYLE}</style><div className="pv-player-power-off" aria-label="Tela fora do horário de funcionamento" /></>;

  return (
    <div className={`pv-player-runtime ${manifest.screen.orientation === "portrait" ? "portrait" : "landscape"}`}>
      <style>{PLAYER_RUNTIME_STYLE}</style>
      <div className={`connection-dot ${connected ? "" : "offline"}`}>{connected ? "" : <><WifiOff /> Conteúdo offline</>}</div>
      <PlayerLayout manifest={manifest} item={item} device={activeDevice} onEnd={handleEnd} onError={handleError} />
    </div>
  );
}

function ActivationView({ activation, error, onRetry }: { activation: { code: string; expiresAt: string } | null; error: string | null; onRetry: () => void }) {
  return (
    <div className="activation-screen">
      <div className="activation-brand"><span className="player-mark"><BrandMark /></span><b>PontoView Player</b></div>
      <section>
        <Monitor /><small>CONECTAR ESTA TELA</small><h1>{activation?.code || "••••••"}</h1>
        <p>No painel PontoView, acesse <b>Telas → Conectar tela</b> e informe este código.</p>
        {activation && <em>O código é temporário e será renovado automaticamente.</em>}
        {error && <div className="activation-error">{error}<button onClick={onRetry}><RefreshCw />Tentar novamente</button></div>}
      </section>
      <footer>pontoview.com.br</footer>
    </div>
  );
}

function PlayerLayout({ manifest, item, device, onEnd, onError }: {
  manifest: PlayerManifest;
  item: ManifestItem | null;
  device: Device;
  onEnd: () => void;
  onError: (detail: string) => void;
}) {
  const settings = manifest.settings;
  const [clock, setClock] = useState(new Date());
  const [infoIndex, setInfoIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);

  const info = useMemo(() => [
    ...(settings.widgets?.news ? manifest.news.map((news) => ({
      kind: "news" as const,
      text: news.title,
      source: news.source || sourceName(news.url),
      url: news.url,
    })) : []),
    ...(settings.widgets?.messages ? manifest.messages.map((message) => ({
      kind: "message" as const,
      text: message.body,
      source: "",
      url: "",
    })) : []),
  ].filter((entry) => entry.text), [settings.widgets, manifest.news, manifest.messages]);

  useEffect(() => {
    setInfoIndex(0);
    if (!info.length) return;
    const timer = window.setInterval(() => setInfoIndex((i) => (i + 1) % info.length), 8000);
    return () => window.clearInterval(timer);
  }, [info.length]);

  const stage = (
    <div className={`pv-stage-transition ${settings.transition === "cut" ? "cut" : ""}`} key={item?.itemId || "standby"}>
      <MediaStage item={item} device={device} organization={manifest.organization} onEnd={onEnd} onError={onError} />
    </div>
  );

  if (settings.layout_mode !== "lframe") return <main className="player-fullscreen">{stage}</main>;
  const currentInfo = info.length ? info[infoIndex % info.length] : null;
  const logoUrl = String(manifest.organization.settings?.logoUrl || "");
  return (
    <main className={`player-lframe side-${settings.side_position} bar-${settings.bar_position}`}>
      <div className="player-main">{stage}</div>
      <aside>
        {settings.widgets?.clock && (
          <div className="live-clock">
            <b>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b>
            {settings.widgets?.date && <small>{clock.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}</small>}
          </div>
        )}
        {settings.widgets?.weather && <WeatherWidget screenId={device.screenId} token={device.token} location={settings.weather_location} />}
        {settings.widgets?.business && <div className="live-business"><Building2 /><span>{manifest.organization.displayName}</span></div>}
      </aside>
      <footer>
        {currentInfo?.kind === "news" ? (
          <>
            <SourceBadge source={currentInfo.source} url={currentInfo.url} />
            <span className="footer-headline" key={`news-${infoIndex}`}>{currentInfo.text}</span>
          </>
        ) : currentInfo?.kind === "message" ? (
          <><b>AVISO</b><span className="footer-headline" key={`message-${infoIndex}`}>{currentInfo.text}</span></>
        ) : (
          <CompanyFooter logoUrl={logoUrl} name={manifest.organization.displayName} />
        )}
      </footer>
    </main>
  );
}

function MediaStage({ item, device, organization, onEnd, onError }: {
  item: ManifestItem | null;
  device: Device;
  organization: PlayerManifest["organization"];
  onEnd: () => void;
  onError: (detail: string) => void;
}) {
  if (!item) return <div className="player-standby"><span className="player-mark"><BrandMark /></span><h1>{organization.displayName}</h1><p>Aguardando conteúdo na playlist.</p></div>;
  const media = item.media;
  const duration = item.durationSeconds || media.durationSeconds || 15;
  if (media.type === "youtube" && media.youtubeVideoId) return <YouTubeStage videoId={media.youtubeVideoId} options={media.youtubeOptions} onEnd={onEnd} onError={onError} />;
  if (media.type === "drive_image" || media.type === "drive_video") return <DriveStage media={media} duration={duration} device={device} onEnd={onEnd} onError={onError} />;
  if (media.type === "webpage" && media.pageUrl) return <TimedStage seconds={duration} onEnd={onEnd}><iframe src={media.pageUrl} title={media.name} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" onError={() => onError("webpage_load_error")} /></TimedStage>;
  if (media.type === "message") return <TimedStage seconds={duration} onEnd={onEnd}><div className="message-stage"><small>COMUNICADO</small><h1>{String(media.messageContent?.title || media.name)}</h1><p>{String(media.messageContent?.body || "")}</p></div></TimedStage>;
  if (media.type === "app") return <TimedStage seconds={duration} onEnd={onEnd}><AppStage appKey={media.appKey} name={media.name} organization={organization} /></TimedStage>;
  return <TimedStage seconds={duration} onEnd={onEnd}><div className="player-standby"><h1>{media.name}</h1></div></TimedStage>;
}

function TimedStage({ seconds, onEnd, children }: { seconds: number; onEnd: () => void; children: React.ReactNode }) {
  useEffect(() => { const timer = window.setTimeout(onEnd, Math.max(1, seconds) * 1000); return () => window.clearTimeout(timer); }, [seconds, onEnd]);
  return <div className="timed-stage">{children}</div>;
}

function DriveStage({ media, duration, device, onEnd, onError }: {
  media: ManifestItem["media"];
  duration: number;
  device: Device;
  onEnd: () => void;
  onError: (detail: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void loadDriveAsset(media, device).then((value) => { objectUrl = value; if (active) setUrl(value); }).catch(() => active && onError("drive_fetch_error"));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media.id, media.driveChecksum, device.screenId, device.token, onError]);
  if (!url) return <div className="player-loading"><Loader2 className="spin" /><small>Preparando {media.name}</small></div>;
  if (media.type === "drive_video") return <video src={url} autoPlay playsInline onEnded={onEnd} onError={() => onError("drive_video_error")} />;
  return <TimedStage seconds={duration} onEnd={onEnd}><img src={url} alt="" onError={() => onError("drive_image_error")} /></TimedStage>;
}

async function loadDriveAsset(media: ManifestItem["media"], device: Device) {
  const cache = await caches.open("pontoview-media-v1");
  const key = new Request(`${location.origin}/__pv_cache/${device.screenId}/${media.id}/${media.driveChecksum || "latest"}`);
  const cached = await cache.match(key);
  if (cached) return URL.createObjectURL(await cached.blob());
  if (!navigator.onLine) throw new Error("offline");
  const response = await fetch(`${functionsUrl}/drive-media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": device.screenId, "x-screen-token": device.token },
    body: JSON.stringify({ mediaId: media.id }),
  });
  if (!response.ok) throw new Error("drive_media_error");
  await cache.put(key, response.clone());
  return URL.createObjectURL(await response.blob());
}

function YouTubeStage({ videoId, options, onEnd, onError }: { videoId: string; options: Record<string, unknown>; onEnd: () => void; onError: (detail: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const controls = Boolean(options?.controls);
  const mute = Boolean(options?.mute);
  const volume = Number(options?.volume ?? 100);
  const start = Number(options?.start || 0);
  const rawEnd = Number(options?.end || 0);
  const end = rawEnd > 0 ? rawEnd : undefined;
  useEffect(() => {
    let active = true;
    loadYouTubeApi().then(() => {
      if (!active || !host.current) return;
      player.current = new window.YT.Player(host.current, {
        videoId,
        playerVars: { autoplay: 1, controls: controls ? 1 : 0, mute: mute ? 1 : 0, start, end, playsinline: 1, rel: 0, loop: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: (event: any) => { event.target.setVolume(volume); if (mute) event.target.mute(); event.target.playVideo(); },
          onStateChange: (event: any) => { if (event.data === 0) onEndRef.current(); },
          onError: (event: any) => onErrorRef.current(`youtube_${event.data}`),
        },
      });
    }).catch(() => onErrorRef.current("youtube_api_error"));
    return () => { active = false; const current = player.current; player.current = null; current?.destroy?.(); };
  }, [videoId, controls, mute, volume, start, end]);
  return <div className="youtube-stage" ref={host} />;
}

let youtubePromise: Promise<void> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubePromise) return youtubePromise;
  youtubePromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("youtube"));
    document.head.appendChild(script);
  });
  return youtubePromise;
}

function AppStage({ appKey, name, organization }: { appKey: string | null; name: string; organization: PlayerManifest["organization"] }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  if (appKey === "clock") return <div className="clock-app"><b>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b><span>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span></div>;
  return <div className="generic-app"><span className="player-mark"><BrandMark /></span><small>APP PONTOVIEW</small><h1>{name}</h1><p>{organization.displayName}</p></div>;
}

type ForecastDay = {
  date: string;
  weather_code: number | null;
  condition?: string;
  temp_min: number | null;
  temp_max: number | null;
  precipitation_probability?: number | null;
};

type WeatherData = {
  temperature: number | null;
  apparent_temperature?: number | null;
  humidity?: number | null;
  wind_speed?: number | null;
  weather_code?: number | null;
  condition?: string;
  name?: string;
  forecast?: ForecastDay[];
};

function WeatherWidget({ screenId, token, location }: {
  screenId: string;
  token: string;
  location: PlayerManifest["settings"]["weather_location"];
}) {
  const [data, setData] = useState<WeatherData | null>(null);
  const locationKey = JSON.stringify(location || {});
  useEffect(() => {
    let active = true;
    const load = () => void fetch(`${functionsUrl}/screens-weather`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": screenId, "x-screen-token": token },
      body: "{}",
    }).then((response) => response.ok ? response.json() : null).then((result) => { if (active && result) setData(result); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 10 * 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [screenId, token, locationKey]);

  const forecast = Array.isArray(data?.forecast) ? data.forecast.slice(1, 4) : [];
  return (
    <div className="live-weather">
      <div className="weather-current">
        <WeatherGlyph code={data?.weather_code} />
        <span>
          <b>{data?.temperature != null ? `${Math.round(data.temperature)}°` : "—"}</b>
          <small className="condition">{data?.condition || "Clima"}</small>
          <small>{data?.name || String(location?.name || "Configure a cidade")}</small>
          {(data?.apparent_temperature != null || data?.wind_speed != null) && (
            <span className="weather-detail">
              {data?.apparent_temperature != null && <em style={{ fontStyle: "normal" }}>Sensação {Math.round(data.apparent_temperature)}°</em>}
              {data?.wind_speed != null && <em style={{ fontStyle: "normal", display: "inline-flex", alignItems: "center", gap: 3 }}><Wind />{Math.round(data.wind_speed)} km/h</em>}
            </span>
          )}
        </span>
      </div>
      {forecast.length > 0 && (
        <div className="weather-forecast">
          {forecast.map((day) => (
            <div className="weather-day" key={day.date} title={day.condition || "Previsão"}>
              <small>{forecastLabel(day.date)}</small>
              <WeatherGlyph code={day.weather_code} />
              <span><b>{day.temp_max != null ? `${Math.round(day.temp_max)}°` : "—"}</b><i className="min">{day.temp_min != null ? `${Math.round(day.temp_min)}°` : "—"}</i></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeatherGlyph({ code }: { code?: number | null }) {
  const value = Number(code ?? 3);
  const Icon = value <= 1 ? Sun
    : value === 2 ? CloudSun
      : value === 3 ? Cloud
        : [45, 48].includes(value) ? CloudFog
          : [71, 73, 75].includes(value) ? Snowflake
            : [95, 96, 99].includes(value) ? CloudLightning
              : CloudRain;
  return <Icon aria-hidden="true" />;
}

function forecastLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Dia";
  return parsed.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function SourceBadge({ source, url }: { source: string; url: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const favicon = faviconUrl(url);
  return (
    <span className="news-source">
      <span className="news-source-icon">
        <Newspaper />
        {favicon && !imageFailed && <img src={favicon} alt="" onError={() => setImageFailed(true)} />}
      </span>
      <strong>{source || "Fonte"}</strong>
    </span>
  );
}

function CompanyFooter({ logoUrl, name }: { logoUrl: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (logoUrl && !imageFailed) {
    return <span className="footer-company"><img src={logoUrl} alt={name} onError={() => setImageFailed(true)} /></span>;
  }
  return <span className="footer-company"><Building2 /><strong>{name}</strong></span>;
}

function BrandMark() {
  const [imageFailed, setImageFailed] = useState(false);
  return imageFailed
    ? <span className="pv-brand-fallback">PV</span>
    : <img className="pv-brand-official" src="/assets/pontoview-icon.svg" alt="" onError={() => setImageFailed(true)} />;
}

function sourceName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte";
  }
}

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return "";
  }
}

function readDevice(): Device | null {
  try { const value = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null"); return value?.screenId && value?.token ? value : null; } catch { return null; }
}
function readManifest(id: string): PlayerManifest | null {
  try { return JSON.parse(localStorage.getItem(`pv_manifest_${id}`) || "null"); } catch { return null; }
}
interface YTPlayer { destroy?: () => void; }
declare global {
  interface Window {
    YT: { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

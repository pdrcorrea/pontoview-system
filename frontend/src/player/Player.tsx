import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Info,
  Loader2,
  MessageSquareText,
  Newspaper,
  RefreshCw,
  Snowflake,
  Sun,
  WifiOff,
  Wind,
} from "lucide-react";
import { isWithinOperatingHours } from "../lib/operatingHours";
import { CURRENT_PLAYER_VERSION } from "../lib/playerVersion";
import { functionsUrl, supabase, supabasePublishableKey } from "../lib/supabase";
import type { PlayerManifest } from "../types";

const PLAYER_VERSION = CURRENT_PLAYER_VERSION;
const DEVICE_KEY = "pontoview_player_device_v1";
const NEWS_REFRESH_MS = 5 * 60_000;
const PLAYER_RUNTIME_STYLE = `
  .pv-orientation-canvas { position: fixed; left: 50%; top: 50%; overflow: hidden; background: #000; transform-origin: center center; }
  .pv-orientation-canvas .player-fullscreen, .pv-orientation-canvas .player-lframe { width: 100% !important; height: 100% !important; min-width: 0; min-height: 0; }
  .pv-orientation-canvas .player-fullscreen { min-height: 100% !important; }
  .pv-stage-transition { width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: #000; animation: pv-stage-in 560ms cubic-bezier(.22,.61,.36,1) both; will-change: opacity, transform; }
  .pv-stage-transition.cut { animation: none; }
  @keyframes pv-stage-in { from { opacity: 0; transform: scale(1.006); } to { opacity: 1; transform: scale(1); } }
  @keyframes pv-side-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .pv-player-power-off { position: fixed; inset: 0; z-index: 99999; width: 100vw; height: 100vh; background: #000; cursor: none; }
  .pv-brand-official { width: 100%; height: 100%; object-fit: contain; display: block; }
  .pv-brand-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: .7em; letter-spacing: -.04em; }
  .side-rotation-slot { min-height: 0; width: 100%; flex: 1 1 auto; display: flex; align-items: stretch; }
  .side-panel-slide { width: 100%; min-height: 0; animation: pv-side-in 420ms ease both; }
  .side-panel-slide[hidden] { display: none !important; }
  .side-message { height: 100%; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.5vh; border-radius: 1.2vw; padding: .3vw; }
  .side-message-label { display: inline-flex; width: fit-content; align-items: center; gap: .55em; font-size: clamp(9px,.75vw,13px); font-weight: 800; letter-spacing: .12em; color: #244f7e; }
  .side-message-label svg { width: 1.2em; height: 1.2em; }
  .side-message h2 { margin: 0; font-size: clamp(20px,2vw,38px); line-height: 1.08; color: #17344f; overflow-wrap: anywhere; }
  .side-message p { margin: 0; font-size: clamp(14px,1.28vw,24px); line-height: 1.34; color: #40586d; overflow-wrap: anywhere; }
  .side-message.variant-attention .side-message-label, .side-message.priority-urgent .side-message-label { color: #9a4f20; }
  .side-message.variant-info .side-message-label { color: #236b8e; }
  .side-message.variant-success .side-message-label { color: #26735a; }
  .side-message.priority-urgent { border-left: .35vw solid #9a4f20; padding-left: 1vw; }
  .side-message.priority-important { border-left: .25vw solid #d39a3a; padding-left: .9vw; }
  .side-message.exclusive { background: rgba(255,255,255,.46); }
  .live-weather { display: block; width: 100%; min-width: 0; }
  .weather-current { display: grid; grid-template-columns: clamp(30px,3vw,58px) minmax(0,1fr); align-items: center; gap: clamp(8px,1vw,18px); min-width: 0; }
  .weather-current > svg { width: 100%; max-width: 58px; height: auto; min-width: 0; }
  .weather-current > span { min-width: 0; }
  .weather-current > span > small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .live-weather small.condition { opacity: .8; }
  .live-weather .weather-detail { display: flex; flex-wrap: wrap; align-items: center; gap: .2em .7em; margin-top: .25em; font-size: clamp(8px,.72vw,13px); color: #61768a; white-space: normal; }
  .live-weather .weather-detail svg { width: 1em; height: 1em; flex: 0 0 auto; }
  .weather-forecast { width: 100%; min-width: 0; box-sizing: border-box; margin-top: 2.2vh; border-top: 1px solid #d6e0e7; padding-top: 1.7vh; display: grid; gap: 1.15vh; }
  .weather-day { width: 100%; min-width: 0; box-sizing: border-box; display: grid !important; grid-template-columns: minmax(34px,.68fr) clamp(20px,1.45vw,28px) minmax(0,1.45fr); align-items: center; column-gap: clamp(6px,.55vw,11px); color: #40586d; }
  .weather-day > small { min-width: 0; font-size: clamp(8px,.74vw,13px); font-weight: 700; color: #40586d; text-transform: uppercase; letter-spacing: .04em; }
  .weather-day > svg { width: clamp(17px,1.45vw,28px); max-width: 100%; height: auto; color: #244f7e; justify-self: center; }
  .weather-day > span { min-width: 0; display: grid !important; grid-template-columns: minmax(0,1fr) auto; align-items: baseline; justify-items: end; column-gap: clamp(4px,.35vw,8px); font-size: clamp(9px,.82vw,15px); white-space: nowrap; padding-right: 1px; }
  .weather-day > span > b { display: block; min-width: 0; font-size: clamp(24px,2.15vw,40px); line-height: .95; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
  .weather-day .min { display: block; color: #6a8295; font-size: clamp(11px,.92vw,17px); line-height: 1; align-self: start; padding-top: .1em; font-variant-numeric: tabular-nums; }
  .player-lframe > footer .news-source { display: inline-flex; align-items: center; gap: .55em; flex: 0 0 auto; animation: none; }
  .news-source-icon { position: relative; width: 1.7em; height: 1.7em; border-radius: .38em; background: #edf3f7; display: grid !important; place-items: center; overflow: hidden; }
  .news-source-icon svg { width: 56%; height: 56%; color: #244f7e; }
  .news-source-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .news-source strong { font-size: .72em; color: #244f7e; max-width: 14em; overflow: hidden; text-overflow: ellipsis; }
  .footer-headline { overflow: hidden; text-overflow: ellipsis; }
  .footer-message-label.urgent { background:#8d3d24; }
  .footer-message-label.important { background:#9a6b23; }
  .footer-company { display: flex !important; align-items: center; height: 70%; gap: .7em; animation: none !important; }
  .footer-company img { max-height: 100%; max-width: min(28vw,320px); object-fit: contain; }
  .footer-company svg { width: 1.25em; height: 1.25em; color: #244f7e; }
  .footer-company strong { font-size: .85em; color: #244f7e; }
  /* Em retrato, a coluna informativa tem largura mínima legível e o restante fica livre para a mídia. */
  .pv-orientation-canvas.logical-portrait .player-lframe.side-right { grid-template-columns: minmax(0, 1fr) clamp(220px, 23%, 320px); }
  .pv-orientation-canvas.logical-portrait .player-lframe.side-left { grid-template-columns: clamp(220px, 23%, 320px) minmax(0, 1fr); }
  .pv-orientation-canvas.logical-portrait .player-lframe > aside { min-width: 220px; padding: 3vh clamp(12px, 1.2vw, 20px); gap: 2vh; }
  .pv-orientation-canvas.logical-portrait .side-message h2 { font-size: clamp(18px,2.6vw,34px); }
  .pv-orientation-canvas.logical-portrait .side-message p { font-size: clamp(13px,1.8vw,21px); }
  .pv-orientation-canvas.logical-portrait .weather-forecast { gap: .75vh; }
  .pv-orientation-canvas.logical-portrait .weather-day { grid-template-columns: minmax(34px,.66fr) clamp(20px,1.35vw,26px) minmax(0,1.5fr); }
  @media (orientation: portrait) { .news-source strong { max-width: 8em; } }
  @media (prefers-reduced-motion: reduce) { .pv-stage-transition, .side-panel-slide { animation-duration: 1ms; } }
`;

type Device = { screenId: string; token: string };
type ManifestItem = PlayerManifest["items"][number];
type PlayerMessage = PlayerManifest["messages"][number];

export function PlayerPage() {
  const params = useParams();
  const [device, setDevice] = useState<Device | null>(() => readDevice());
  const [activation, setActivation] = useState<{ id: string; code: string; expiresAt: string } | null>(null);
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [index, setIndex] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [runtimeNow, setRuntimeNow] = useState(new Date());
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const activationStarted = useRef(false);
  const newsFetch = useRef<{ key: string; at: number; items: PlayerManifest["news"] }>({ key: "", at: 0, items: [] });
  const routeScreenId = params.screenId;
  const activeDevice = device && (!routeScreenId || routeScreenId === device.screenId) ? device : null;

  useEffect(() => { const timer = window.setInterval(() => setRuntimeNow(new Date()), 15000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!manifest) return;
    const native = nativeBridgeContext();
    if (!native) return;
    try {
      native.bridge.setAutoStart(native.session, manifest.settings?.auto_start !== false);
    } catch {}
  }, [manifest?.settings?.auto_start, manifest?.screen?.id]);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize); window.addEventListener("orientationchange", resize);
    return () => { window.removeEventListener("resize", resize); window.removeEventListener("orientationchange", resize); };
  }, []);

  const startActivation = useCallback(async () => {
    if (activationStarted.current) return;
    activationStarted.current = true;
    const result = await supabase.rpc("create_screen_activation");
    if (result.error) { setError(result.error.message); activationStarted.current = false; return; }
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
        localStorage.setItem(DEVICE_KEY, JSON.stringify(next)); setDevice(next); setActivation(null); window.clearInterval(poll);
      }
      if (state.status === "expired") { setActivation(null); activationStarted.current = false; void startActivation(); }
    }, 2000);
    return () => window.clearInterval(poll);
  }, [activation, startActivation]);

  const sync = useCallback(async (silent = false) => {
    if (!activeDevice) return;
    const result = await supabase.rpc("get_player_manifest", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token });
    if (result.error) {
      const cached = readManifest(activeDevice.screenId);
      if (cached) { setManifest(cached); setConnected(false); } else if (!silent) setError("Não foi possível sincronizar este Player.");
      if (result.error.message.includes("INVALID_DEVICE_TOKEN")) { localStorage.removeItem(DEVICE_KEY); setDevice(null); activationStarted.current = false; }
      return;
    }

    const next = result.data as PlayerManifest;
    const reloadRevision = Number(next.screen.reloadRevision || 0);
    const reloadKey = `pv_reload_revision_${activeDevice.screenId}`;
    const previousReload = localStorage.getItem(reloadKey);
    if (previousReload === null) localStorage.setItem(reloadKey, String(reloadRevision));
    else if (reloadRevision > Number(previousReload || 0)) {
      localStorage.setItem(reloadKey, String(reloadRevision)); await clearPlayerCache(activeDevice.screenId);
      const reloadUrl = new URL(window.location.href); reloadUrl.searchParams.set("pv_reload", String(reloadRevision)); window.location.replace(reloadUrl.toString()); return;
    }

    const messageResult = await supabase.rpc("get_player_messages", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token });
    if (!messageResult.error && Array.isArray(messageResult.data)) next.messages = messageResult.data as PlayerManifest["messages"];

    if (next.settings?.widgets?.news) {
      const categories = (next.settings.news_categories || ["general"]).join(",");
      const shouldRefresh = newsFetch.current.key !== categories || Date.now() - newsFetch.current.at >= NEWS_REFRESH_MS || !newsFetch.current.items.length;
      if (shouldRefresh) {
        try {
          const news = await fetch(`${functionsUrl}/screens-news`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": activeDevice.screenId, "x-screen-token": activeDevice.token }, body: "{}" }).then((response) => response.ok ? response.json() : null);
          if (Array.isArray(news?.items) && news.items.length) newsFetch.current = { key: categories, at: Date.now(), items: news.items };
          else newsFetch.current = { ...newsFetch.current, key: categories, at: Date.now() };
        } catch { newsFetch.current = { ...newsFetch.current, key: categories, at: Date.now() }; }
      }
      if (newsFetch.current.items.length) next.news = newsFetch.current.items;
    } else next.news = [];

    localStorage.setItem(`pv_manifest_${activeDevice.screenId}`, JSON.stringify(next));
    const native = nativeBridgeContext();
    if (native) {
      try { native.bridge.syncManifest(native.session, activeDevice.screenId, activeDevice.token, JSON.stringify(next)); } catch {}
    }
    setManifest(next); setConnected(true); setError(null); setIndex((current) => Math.min(current, Math.max(0, next.items.length - 1)));
  }, [activeDevice]);

  useEffect(() => {
    void sync(); const timer = window.setInterval(() => void sync(true), 15000);
    const online = () => { setConnected(true); void sync(true); }; const offline = () => setConnected(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [sync]);

  const operating = manifest ? isWithinOperatingHours(manifest.settings?.operating_hours, manifest.organization.timezone, runtimeNow) : true;
  const item = operating ? manifest?.items[index] || null : null;
  const playbackRef = useRef<{ manifest: PlayerManifest | null; item: ManifestItem | null; index: number }>({ manifest: null, item: null, index: 0 });
  useEffect(() => { playbackRef.current = { manifest, item, index }; }, [manifest, item, index]);

  useEffect(() => {
    if (!activeDevice || !manifest) return;
    const heartbeat = () => void supabase.rpc("player_heartbeat", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token, p_media_id: operating ? item?.media.id || null : null, p_playlist_id: operating ? manifest.playlist?.id || null : null, p_player_version: PLAYER_VERSION, p_client_info: { userAgent: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, online: navigator.onLine, orientation: manifest.screen.orientation, operating, nativeAppVersion: window.__PV_NATIVE_APP_VERSION || null, nativeDiagnostics: window.__PV_NATIVE_DIAGNOSTICS || null } });
    heartbeat(); const timer = window.setInterval(heartbeat, 30000); return () => window.clearInterval(timer);
  }, [activeDevice, manifest?.playlist?.id, manifest?.screen.orientation, operating, item?.media.id]);

  useEffect(() => {
    if (!operating || !activeDevice || !manifest || !item) return;
    void supabase.rpc("player_event", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token, p_event_type: "content_started", p_media_id: item.media.id, p_playlist_id: manifest.playlist?.id || null, p_payload: { position: index } });
  }, [operating, activeDevice, manifest?.playlist?.id, item?.itemId, index]);

  const advance = useCallback((failed = false, detail?: string) => {
    const current = playbackRef.current; if (!current.manifest || !activeDevice || !current.item) return;
    void supabase.rpc("player_event", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token, p_event_type: failed ? "media_error" : "content_ended", p_media_id: current.item.media.id, p_playlist_id: current.manifest.playlist?.id || null, p_payload: failed ? { detail: detail || "playback_error" } : { position: current.index } });
    const itemCount = Math.max(1, current.manifest.items.length);
    setPlaybackCycle((cycle) => cycle + 1);
    setIndex((position) => (position + 1) % itemCount);
  }, [activeDevice]);
  const handleEnd = useCallback(() => advance(false), [advance]);
  const handleError = useCallback((detail: string) => advance(true, detail), [advance]);
  useEffect(() => { if (!operating) return; if (item?.media.onlineRequired && !navigator.onLine) { const timer = window.setTimeout(() => advance(true, "offline_content_skipped"), 500); return () => window.clearTimeout(timer); } }, [operating, item?.itemId, advance]);

  if (!activeDevice) return <ActivationView activation={activation} error={error} onRetry={() => { setError(null); activationStarted.current = false; void startActivation(); }} />;
  if (!manifest) return <div className="player-boot"><span className="player-mark"><BrandMark /></span><Loader2 className="spin" /><p>Sincronizando conteúdo…</p>{error && <small>{error}</small>}</div>;
  if (!operating) return <><style>{PLAYER_RUNTIME_STYLE}</style><div className="pv-player-power-off" aria-label="Tela fora do horário de funcionamento" /></>;

  const configuredPortrait = manifest.screen.orientation === "portrait";
  const viewportPortrait = viewport.height >= viewport.width;
  const rotateCanvas = configuredPortrait !== viewportPortrait;
  const canvasStyle = rotateCanvas ? { width: `${viewport.height}px`, height: `${viewport.width}px`, transform: "translate(-50%, -50%) rotate(90deg)" } : { width: `${viewport.width}px`, height: `${viewport.height}px`, transform: "translate(-50%, -50%)" };
  return <div className={`pv-player-runtime ${configuredPortrait ? "portrait" : "landscape"}`}><style>{PLAYER_RUNTIME_STYLE}</style><div className={`connection-dot ${connected ? "" : "offline"}`}>{connected ? "" : <><WifiOff /> Conteúdo offline</>}</div><div className={`pv-orientation-canvas ${configuredPortrait ? "logical-portrait" : "logical-landscape"} ${rotateCanvas ? "rotated" : ""}`} style={canvasStyle}><PlayerLayout manifest={manifest} item={item} device={activeDevice} playbackCycle={playbackCycle} onEnd={handleEnd} onError={handleError} /></div></div>;
}

function ActivationView({ activation, error, onRetry }: { activation: { code: string; expiresAt: string } | null; error: string | null; onRetry: () => void }) {
  return <div className="activation-screen"><section><span className="activation-mark" aria-hidden="true"><BrandMark /></span><small>CONECTAR ESTA TELA</small><h1>{activation?.code || "••••••"}</h1><p>No painel PontoView, acesse <b>Telas → Conectar tela</b> e informe este código.</p>{activation && <em>O código é temporário e será renovado automaticamente.</em>}{error && <div className="activation-error">{error}<button onClick={onRetry}><RefreshCw />Tentar novamente</button></div>}</section><footer>pontoview.com.br</footer></div>;
}

function PlayerLayout({ manifest, item, device, playbackCycle, onEnd, onError }: { manifest: PlayerManifest; item: ManifestItem | null; device: Device; playbackCycle: number; onEnd: () => void; onError: (detail: string) => void; }) {
  const settings = manifest.settings;
  const [clock, setClock] = useState(new Date());
  const [infoIndex, setInfoIndex] = useState(0);
  const [sideIndex, setSideIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);

  const footerMessages = useMemo(() => manifest.messages.filter((message) => (message.displayLocation || "footer") === "footer"), [manifest.messages]);
  const sideMessages = useMemo(() => manifest.messages.filter((message) => message.displayLocation === "sidebar"), [manifest.messages]);
  const exclusiveSideMessages = useMemo(() => sideMessages.filter((message) => message.isExclusive), [sideMessages]);
  const effectiveSideMessages = exclusiveSideMessages.length ? [exclusiveSideMessages[0]] : sideMessages;
  const weightedSideMessages = useMemo(() => effectiveSideMessages.flatMap((message) => message.priority === "urgent" ? [message, message] : [message]), [effectiveSideMessages]);

  const info = useMemo(() => [
    ...(settings.widgets?.news ? manifest.news.map((news) => ({ kind: "news" as const, text: news.title, source: news.source || sourceName(news.url), url: news.url, message: null as PlayerMessage | null })) : []),
    ...(settings.widgets?.messages ? footerMessages.map((message) => ({ kind: "message" as const, text: message.body, source: "", url: "", message })) : []),
  ].filter((entry) => entry.text), [settings.widgets, manifest.news, footerMessages]);

  const sideSlides = useMemo(() => [
    ...(!exclusiveSideMessages.length && settings.widgets?.weather ? [{ kind: "weather" as const, key: "weather" }] : []),
    ...(settings.widgets?.messages ? weightedSideMessages.map((message, position) => ({ kind: "message" as const, key: `${message.id}-${position}`, message })) : []),
  ], [settings.widgets?.weather, settings.widgets?.messages, weightedSideMessages, exclusiveSideMessages.length]);

  useEffect(() => { setInfoIndex(0); }, [info.length]);
  useEffect(() => {
    if (info.length <= 1) return;
    const current = info[infoIndex % info.length];
    const delay = current.kind === "message" && current.message ? messageDisplayMs(current.message) : 8000;
    const timer = window.setTimeout(() => setInfoIndex((i) => (i + 1) % info.length), delay);
    return () => window.clearTimeout(timer);
  }, [infoIndex, info]);

  useEffect(() => { setSideIndex(0); }, [sideSlides.length]);
  useEffect(() => {
    if (sideSlides.length <= 1) return;
    const slide = sideSlides[sideIndex % sideSlides.length];
    const delay = slide.kind === "message" ? messageDisplayMs(slide.message) : 10_000;
    const timer = window.setTimeout(() => setSideIndex((current) => (current + 1) % sideSlides.length), delay);
    return () => window.clearTimeout(timer);
  }, [sideIndex, sideSlides]);

  const nextDriveMedia = useMemo(() => {
    if (!item || manifest.items.length < 2) return null;
    const currentPosition = manifest.items.findIndex((candidate) => candidate.itemId === item.itemId);
    if (currentPosition < 0) return null;
    const next = manifest.items[(currentPosition + 1) % manifest.items.length];
    return next && (next.media.type === "drive_image" || next.media.type === "drive_video") ? next.media : null;
  }, [manifest.items, item?.itemId]);
  const preloader = nextDriveMedia ? <DrivePreloader media={nextDriveMedia} device={device} /> : null;
  const stage = <div className={`pv-stage-transition ${settings.transition === "cut" ? "cut" : ""}`} key={`${item?.itemId || "standby"}-${playbackCycle}`}><MediaStage item={item} device={device} organization={manifest.organization} cacheRevision={Number(manifest.screen.reloadRevision || 0)} onEnd={onEnd} onError={onError} /></div>;
  if (settings.layout_mode !== "lframe") return <>{preloader}<main className="player-fullscreen">{stage}</main></>;
  const currentInfo = info.length ? info[infoIndex % info.length] : null;
  const currentSide = sideSlides.length ? sideSlides[sideIndex % sideSlides.length] : null;
  const logoUrl = String(manifest.organization.settings?.logoUrl || "");

  return <>{preloader}<main className={`player-lframe side-${settings.side_position} bar-${settings.bar_position}`}>
    <div className="player-main">{stage}</div>
    <aside>
      {settings.widgets?.clock && <div className="live-clock"><b>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b>{settings.widgets?.date && <small>{clock.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}</small>}</div>}
      {sideSlides.length > 0 && <div className="side-rotation-slot">
        {!exclusiveSideMessages.length && settings.widgets?.weather && <div className="side-panel-slide" hidden={currentSide?.kind !== "weather"}><WeatherWidget screenId={device.screenId} token={device.token} location={settings.weather_location} /></div>}
        {currentSide?.kind === "message" && <div className="side-panel-slide" key={`side-message-${currentSide.key}`}><SideMessage message={currentSide.message} /></div>}
      </div>}
      {settings.widgets?.business && <CompanySide logoUrl={logoUrl} name={manifest.organization.displayName} />}
    </aside>
    <footer>
      {currentInfo?.kind === "news" ? <><SourceBadge source={currentInfo.source} url={currentInfo.url} /><span className="footer-headline" key={`news-${infoIndex}`}>{currentInfo.text}</span></>
      : currentInfo?.kind === "message" && currentInfo.message ? <><b className={`footer-message-label ${currentInfo.message.priority || "normal"}`}>{currentInfo.message.priority === "urgent" ? "URGENTE" : currentInfo.message.priority === "important" ? "IMPORTANTE" : "AVISO"}</b><span className="footer-headline" key={`message-${infoIndex}`}>{currentInfo.text}</span></>
      : <CompanyFooter logoUrl={logoUrl} name={manifest.organization.displayName} />}
    </footer>
  </main></>;
}

function SideMessage({ message }: { message: PlayerMessage }) {
  const variant = message.styleVariant || "standard";
  const priority = message.priority || "normal";
  const Icon = variant === "attention" ? AlertTriangle : variant === "info" ? Info : variant === "success" ? CheckCircle2 : MessageSquareText;
  return <div className={`side-message variant-${variant} priority-${priority} ${message.isExclusive ? "exclusive" : ""}`}>
    <span className="side-message-label"><Icon /> {message.isExclusive ? "DESTAQUE" : priority === "urgent" ? "URGENTE" : priority === "important" ? "IMPORTANTE" : "MENSAGEM"}</span>
    {message.title && <h2>{message.title}</h2>}<p>{message.body}</p>
  </div>;
}

function messageDisplayMs(message: PlayerMessage) {
  if (message.durationMode === "manual" && Number(message.durationSeconds) >= 5) return Math.min(120, Number(message.durationSeconds)) * 1000;
  const text = `${message.title || ""} ${message.body}`.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const readingSeconds = 4 + words / 3;
  return Math.round(Math.min(24, Math.max(8, readingSeconds)) * 1000);
}

function MediaStage({ item, device, organization, cacheRevision, onEnd, onError }: { item: ManifestItem | null; device: Device; organization: PlayerManifest["organization"]; cacheRevision: number; onEnd: () => void; onError: (detail: string) => void; }) {
  if (!item) return <div className="player-standby"><span className="player-mark"><BrandMark /></span><h1>{organization.displayName}</h1><p>Aguardando conteúdo na playlist.</p></div>;
  const media = item.media; const duration = item.durationSeconds || media.durationSeconds || 15;
  if (media.type === "youtube" && media.youtubeVideoId) return <YouTubeStage videoId={media.youtubeVideoId} options={media.youtubeOptions} onEnd={onEnd} onError={onError} />;
  if (media.type === "drive_image" || media.type === "drive_video") return <DriveStage media={media} duration={duration} device={device} onEnd={onEnd} onError={onError} />;
  if (media.type === "webpage" && media.pageUrl) return <TimedStage seconds={duration} onEnd={onEnd}><iframe src={cacheBustedUrl(media.pageUrl, cacheRevision)} title={media.name} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" onError={() => onError("webpage_load_error")} /></TimedStage>;
  if (media.type === "message") return <TimedStage seconds={duration} onEnd={onEnd}><div className="message-stage"><small>COMUNICADO</small><h1>{String(media.messageContent?.title || media.name)}</h1><p>{String(media.messageContent?.body || "")}</p></div></TimedStage>;
  if (media.type === "app") return <TimedStage seconds={duration} onEnd={onEnd}><AppStage appKey={media.appKey} name={media.name} organization={organization} /></TimedStage>;
  return <TimedStage seconds={duration} onEnd={onEnd}><div className="player-standby"><h1>{media.name}</h1></div></TimedStage>;
}

function TimedStage({ seconds, onEnd, children }: { seconds: number; onEnd: () => void; children: React.ReactNode }) { useEffect(() => { const timer = window.setTimeout(onEnd, Math.max(1, seconds) * 1000); return () => window.clearTimeout(timer); }, [seconds, onEnd]); return <div className="timed-stage">{children}</div>; }

type DrivePreloadEntry = { promise: Promise<string>; createdAt: number };
const drivePreloads = new Map<string, DrivePreloadEntry>();
const DRIVE_PRELOAD_TTL_MS = 2 * 60_000;

function driveAssetKey(media: ManifestItem["media"], device: Device) {
  return `${device.screenId}:${media.id}:${media.driveChecksum || media.driveModifiedTime || "latest"}`;
}

type NativeBridgeContext = {
  bridge: NonNullable<Window["PontoViewNative"]>;
  session: string;
};

function nativeBridgeContext(): NativeBridgeContext | null {
  const bridge = window.PontoViewNative;
  const session = window.__PV_NATIVE_SESSION;
  return bridge && session ? { bridge, session } : null;
}

function useNativeBridgeContext() {
  const [, setGeneration] = useState(0);
  useEffect(() => {
    const handleReady = () => setGeneration((value) => value + 1);
    window.addEventListener("pontoview-native-ready", handleReady);

    // Some Android WebViews finish the native injection before React mounts.
    // Poll for a few seconds so a missed event never leaves Drive video on <video>.
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (nativeBridgeContext() || attempts >= 40) {
        setGeneration((value) => value + 1);
        window.clearInterval(timer);
      }
    }, 250);

    return () => {
      window.removeEventListener("pontoview-native-ready", handleReady);
      window.clearInterval(timer);
    };
  }, []);
  return nativeBridgeContext();
}

function nativeBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  let rotation = 0;
  let node: HTMLElement | null = element;
  while (node) {
    const transform = window.getComputedStyle(node).transform;
    if (transform && transform !== "none") {
      const match = /^matrix\(([^,]+),\s*([^,]+),/.exec(transform);
      if (match) rotation += Math.atan2(Number(match[2]), Number(match[1])) * 180 / Math.PI;
    }
    node = node.parentElement;
  }
  const snapped = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    rotation: snapped,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

async function requestDriveStream(media: ManifestItem["media"], device: Device) {
  if (!navigator.onLine) throw new Error("offline");
  const response = await fetch(`${functionsUrl}/drive-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabasePublishableKey || "",
      "x-screen-id": device.screenId,
      "x-screen-token": device.token,
    },
    body: JSON.stringify({ mediaId: media.id, action: "ticket" }),
  });
  if (!response.ok) throw new Error("drive_stream_ticket_error");
  const payload = await response.json();
  if (!payload?.streamUrl) throw new Error("drive_stream_url_missing");
  return payload as { streamUrl: string; mimeType?: string; expiresAt?: string };
}

function preloadDriveAsset(media: ManifestItem["media"], device: Device) {
  const key = driveAssetKey(media, device);
  const now = Date.now();
  for (const [entryKey, entry] of drivePreloads) {
    if (now - entry.createdAt > DRIVE_PRELOAD_TTL_MS) drivePreloads.delete(entryKey);
  }
  const existing = drivePreloads.get(key);
  if (existing) return existing.promise;
  const promise = fetchDriveAsset(media, device).catch((error) => {
    const current = drivePreloads.get(key);
    if (current?.promise === promise) drivePreloads.delete(key);
    throw error;
  });
  drivePreloads.set(key, { promise, createdAt: now });
  return promise;
}

function consumeDriveAsset(media: ManifestItem["media"], device: Device) {
  const key = driveAssetKey(media, device);
  const existing = drivePreloads.get(key);
  if (existing && Date.now() - existing.createdAt <= DRIVE_PRELOAD_TTL_MS) {
    drivePreloads.delete(key);
    return existing.promise;
  }
  drivePreloads.delete(key);
  return fetchDriveAsset(media, device);
}

function DrivePreloader({ media, device }: { media: ManifestItem["media"]; device: Device }) {
  const native = useNativeBridgeContext();
  useEffect(() => {
    let active = true;
    if (native) {
      const key = driveAssetKey(media, device);
      try {
        const alreadyCached = media.type === "drive_video"
          ? native.bridge.hasCachedVideo(native.session, key)
          : native.bridge.hasCachedImage(native.session, key);
        if (alreadyCached) return () => { active = false; };
      } catch {}
      void requestDriveStream(media, device).then(({ streamUrl }) => {
        if (!active) return;
        if (media.type === "drive_video") native.bridge.preloadVideo(native.session, streamUrl, key);
        else native.bridge.preloadImage(native.session, streamUrl, key);
      }).catch(() => {});
      return () => { active = false; };
    }

    let warmVideo: HTMLVideoElement | null = null;
    let warmImage: HTMLImageElement | null = null;
    void preloadDriveAsset(media, device).then((url) => {
      if (!active) return;
      if (media.type === "drive_video") {
        warmVideo = document.createElement("video");
        warmVideo.preload = "auto";
        warmVideo.muted = true;
        warmVideo.playsInline = true;
        warmVideo.setAttribute("aria-hidden", "true");
        warmVideo.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10000px;top:-10000px";
        warmVideo.src = url;
        document.body.appendChild(warmVideo);
        warmVideo.load();
      } else {
        warmImage = new Image();
        warmImage.decoding = "async";
        warmImage.src = url;
      }
    }).catch(() => {});
    return () => {
      active = false;
      if (warmVideo) {
        warmVideo.pause();
        warmVideo.removeAttribute("src");
        warmVideo.load();
        warmVideo.remove();
      }
      if (warmImage) warmImage.src = "";
    };
  }, [media.id, media.driveChecksum, media.type, device.screenId, device.token, native?.session]);
  return null;
}

function DriveStage({ media, duration, device, onEnd, onError }: { media: ManifestItem["media"]; duration: number; device: Device; onEnd: () => void; onError: (detail: string) => void; }) {
  const native = useNativeBridgeContext();

  if (native && media.type === "drive_video") {
    return <AndroidLocalDriveVideoStage media={media} device={device} onEnd={onEnd} onError={onError} native={native} />;
  }

  if (native && media.type === "drive_image") {
    return <NativeDriveStage
      media={media}
      duration={duration}
      device={device}
      onEnd={onEnd}
      onNativeFailure={() => onError("native_drive_image_failed")}
      native={native}
    />;
  }

  return <WebDriveStage media={media} duration={duration} device={device} onEnd={onEnd} onError={onError} />;
}

function AndroidLocalDriveVideoStage({ media, device, onEnd, onError, native }: {
  media: ManifestItem["media"];
  device: Device;
  onEnd: () => void;
  onError: (detail: string) => void;
  native: NativeBridgeContext;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [autoplayMuted, setAutoplayMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundAttemptedRef = useRef(false);
  const retryRef = useRef(false);
  const onErrorRef = useRef(onError);

  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    const key = driveAssetKey(media, device);
    const deadline = Date.now() + 4 * 60_000;

    const useLocal = () => {
      try {
        if (!native.bridge.hasCachedVideo(native.session, key)) return false;
        const localUrl = native.bridge.getLocalVideoUrl(native.session, key);
        if (!localUrl) return false;
        if (active) setUrl(localUrl);
        return true;
      } catch {
        return false;
      }
    };

    const poll = () => {
      if (!active || useLocal()) return;
      if (Date.now() >= deadline) {
        if (active) setFallback(true);
        return;
      }
      timer = window.setTimeout(poll, 650);
    };

    if (!useLocal()) {
      void requestDriveStream(media, device).then(({ streamUrl }) => {
        if (!active) return;
        try {
          native.bridge.preloadVideo(native.session, streamUrl, key);
          poll();
        } catch {
          setFallback(true);
        }
      }).catch(() => {
        if (active) setFallback(true);
      });
    }

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [media.id, media.driveChecksum, media.driveModifiedTime, device.screenId, device.token, native.session]);

  useEffect(() => {
    if (!url || fallback) return;
    let lastTime = -1;
    let lastProgressAt = Date.now();
    let recoveryAt = 0;

    const watchdog = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.ended) return;

      const current = Number(video.currentTime || 0);
      if (current > lastTime + 0.15) {
        lastTime = current;
        lastProgressAt = Date.now();
        return;
      }

      const stalledFor = Date.now() - lastProgressAt;
      if (stalledFor >= 8_000 && Date.now() - recoveryAt > 7_000) {
        recoveryAt = Date.now();
        const resumeAt = current;
        try {
          video.pause();
          video.load();
          video.currentTime = resumeAt;
          video.muted = true;
          setAutoplayMuted(true);
          void video.play().catch(() => {});
        } catch {}
      }

      if (stalledFor >= 20_000) {
        setFallback(true);
      }
    }, 2_000);

    return () => window.clearInterval(watchdog);
  }, [url, fallback]);

  const start = () => {
    const video = videoRef.current;
    if (!video) return;
    video.controls = false;
    video.muted = true;
    setAutoplayMuted(true);
    void video.play().catch(() => {});
  };

  const handlePlaying = () => {
    const video = videoRef.current;
    if (!video || soundAttemptedRef.current) return;
    soundAttemptedRef.current = true;
    window.setTimeout(() => {
      const current = videoRef.current;
      if (!current || current.ended) return;
      current.muted = false;
      setAutoplayMuted(false);
      void current.play().catch(() => {
        current.muted = true;
        setAutoplayMuted(true);
        void current.play().catch(() => {});
      });
    }, 300);
  };

  const handleError = () => {
    if (!retryRef.current) {
      retryRef.current = true;
      const video = videoRef.current;
      if (video) {
        try {
          video.load();
          video.muted = true;
          setAutoplayMuted(true);
          void video.play().catch(() => setFallback(true));
          return;
        } catch {}
      }
    }
    setFallback(true);
  };

  if (fallback) {
    return <WebDriveStage media={media} duration={media.durationSeconds || 15} device={device} onEnd={onEnd} onError={onError} />;
  }

  if (!url) {
    return <div className="drive-stage player-loading"><Loader2 className="spin" /><small>Preparando {media.name}</small></div>;
  }

  return <video
    ref={videoRef}
    src={url}
    autoPlay
    muted={autoplayMuted}
    playsInline
    preload="auto"
    controls={false}
    disablePictureInPicture
    controlsList="nodownload noplaybackrate nofullscreen"
    onLoadedMetadata={start}
    onLoadedData={start}
    onCanPlay={start}
    onPlaying={handlePlaying}
    onEnded={onEnd}
    onError={handleError}
  />;
}

function NativeDriveStage({ media, duration, device, onEnd, onNativeFailure, native }: { media: ManifestItem["media"]; duration: number; device: Device; onEnd: () => void; onNativeFailure: () => void; native: NativeBridgeContext; }) {
  const host = useRef<HTMLDivElement>(null);
  const playbackId = useRef(`pv-${media.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`).current;
  const onEndRef = useRef(onEnd);
  const onNativeFailureRef = useRef(onNativeFailure);
  const readyRef = useRef(false);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onNativeFailureRef.current = onNativeFailure; }, [onNativeFailure]);

  useEffect(() => {
    const previousEnded = window.__pvNativeOnEnded;
    const previousError = window.__pvNativeOnError;
    const previousDiagnostics = window.__pvNativeOnDiagnostics;

    const ended = (id: string) => {
      if (id === playbackId) onEndRef.current();
      else previousEnded?.(id);
    };

    const failed = (id: string, detail?: string) => {
      if (id === playbackId) {
        console.warn("[PontoView] Native Drive playback failed, using WebView fallback:", detail || "native_media_error");
        onNativeFailureRef.current();
      } else {
        previousError?.(id, detail);
      }
    };

    const diagnostics = (id: string, payload: string) => {
      if (id === playbackId) {
        try {
          const data = JSON.parse(payload || "{}");
          window.__PV_NATIVE_DIAGNOSTICS = { ...data, playbackId: id, at: new Date().toISOString() };
          const state = String(data.state || "");
          if (["ready_local_file", "media3_ready", "media3_first_frame", "media3_video_size", "image_ready", "vlc_playing", "vlc_video_output"].some((prefix) => state.startsWith(prefix))) {
            readyRef.current = true;
          }
        } catch {
          readyRef.current = true;
        }
      } else {
        previousDiagnostics?.(id, payload);
      }
    };

    window.__pvNativeOnEnded = ended;
    window.__pvNativeOnError = failed;
    window.__pvNativeOnDiagnostics = diagnostics;

    const startupWatchdog = window.setTimeout(() => {
      if (!readyRef.current) {
        console.warn("[PontoView] Native Drive player did not become ready in time; falling back to WebView.");
        onNativeFailureRef.current();
      }
    }, media.type === "drive_video" ? 12_000 : 20_000);

    return () => {
      window.clearTimeout(startupWatchdog);
      if (window.__pvNativeOnEnded === ended) window.__pvNativeOnEnded = previousEnded;
      if (window.__pvNativeOnError === failed) window.__pvNativeOnError = previousError;
      if (window.__pvNativeOnDiagnostics === diagnostics) window.__pvNativeOnDiagnostics = previousDiagnostics;
    };
  }, [playbackId, media.type]);

  useEffect(() => {
    let active = true;
    const key = driveAssetKey(media, device);

    const apply = (streamUrl: string) => {
      if (!active || !host.current) return;
      const bounds = nativeBounds(host.current);
      if (media.type === "drive_video") {
        native.bridge.playVideo(
          native.session, streamUrl, key, playbackId,
          bounds.x, bounds.y, bounds.width, bounds.height, bounds.rotation,
          bounds.viewportWidth, bounds.viewportHeight, false, 1,
        );
      } else {
        native.bridge.showImage(
          native.session, streamUrl, key, playbackId,
          bounds.x, bounds.y, bounds.width, bounds.height, bounds.rotation,
          bounds.viewportWidth, bounds.viewportHeight,
        );
      }
    };

    try {
      const cached = media.type === "drive_video"
        ? native.bridge.hasCachedVideo(native.session, key)
        : native.bridge.hasCachedImage(native.session, key);
      if (cached) {
        apply("");
      } else {
        void requestDriveStream(media, device).then(({ streamUrl }) => apply(streamUrl)).catch(() => {
          if (active) onNativeFailureRef.current();
        });
      }
    } catch {
      void requestDriveStream(media, device).then(({ streamUrl }) => apply(streamUrl)).catch(() => {
        if (active) onNativeFailureRef.current();
      });
    }

    const updateBounds = () => {
      if (!active || !host.current) return;
      const bounds = nativeBounds(host.current);
      native.bridge.updateBounds(
        native.session, playbackId,
        bounds.x, bounds.y, bounds.width, bounds.height, bounds.rotation,
        bounds.viewportWidth, bounds.viewportHeight,
      );
    };
    const timer = window.setInterval(updateBounds, 750);
    window.addEventListener("resize", updateBounds);
    window.addEventListener("orientationchange", updateBounds);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("orientationchange", updateBounds);
      if (media.type === "drive_video") native.bridge.stopVideo(native.session, playbackId);
      else native.bridge.stopImage(native.session, playbackId);
    };
  }, [media.id, media.driveChecksum, media.type, device.screenId, device.token, native.session, playbackId]);

  const placeholder = <div ref={host} className="drive-stage player-loading"><Loader2 className="spin" /><small>Preparando {media.name}</small></div>;
  return media.type === "drive_image"
    ? <TimedStage seconds={duration} onEnd={onEnd}>{placeholder}</TimedStage>
    : placeholder;
}

function WebDriveStage({ media, duration, device, onEnd, onError }: { media: ManifestItem["media"]; duration: number; device: Device; onEnd: () => void; onError: (detail: string) => void; }) {
  const [url, setUrl] = useState<string | null>(null);
  const [autoplayMuted, setAutoplayMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundAttemptedRef = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => {
    setAutoplayMuted(true);
    soundAttemptedRef.current = false;
    let active = true;
    let objectUrl: string | null = null;
    void consumeDriveAsset(media, device).then((value) => {
      objectUrl = value;
      if (active) setUrl(value);
    }).catch(() => active && onError("drive_fetch_error"));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.id, media.driveChecksum, device.screenId, device.token, onError]);
  useEffect(() => {
    if (media.type !== "drive_video" || !url) return;
    let lastTime = -1;
    let lastProgressAt = Date.now();
    let recoveryAttempted = false;
    let failed = false;
    const watchdog = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.ended || failed) return;
      const currentTime = Number(video.currentTime || 0);
      if (currentTime > lastTime + 0.25) {
        lastTime = currentTime;
        lastProgressAt = Date.now();
        recoveryAttempted = false;
        return;
      }
      const stalledFor = Date.now() - lastProgressAt;
      if (stalledFor >= 25_000 && !recoveryAttempted) {
        recoveryAttempted = true;
        void video.play().catch(() => {});
      }
      if (stalledFor >= 45_000) {
        failed = true;
        onErrorRef.current("drive_video_stalled");
      }
    }, 5_000);
    return () => window.clearInterval(watchdog);
  }, [media.type, url]);
  const startVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    setAutoplayMuted(true);
    void video.play().catch(() => {});
  };
  const handlePlaying = () => {
    const video = videoRef.current;
    if (!video || soundAttemptedRef.current) return;
    soundAttemptedRef.current = true;
    window.setTimeout(() => {
      const current = videoRef.current;
      if (!current || current.ended) return;
      current.muted = false;
      setAutoplayMuted(false);
      void current.play().catch(() => {
        current.muted = true;
        setAutoplayMuted(true);
        void current.play().catch(() => {});
      });
      window.setTimeout(() => {
        if (current.paused && !current.ended) {
          current.muted = true;
          setAutoplayMuted(true);
          void current.play().catch(() => {});
        }
      }, 350);
    }, 250);
  };
  if (!url) return <div className="player-loading"><Loader2 className="spin" /><small>Preparando {media.name}</small></div>;
  if (media.type === "drive_video") return <video ref={videoRef} src={url} autoPlay muted={autoplayMuted} playsInline preload="auto" controls={false} disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" onLoadedData={startVideo} onCanPlay={startVideo} onPlaying={handlePlaying} onEnded={onEnd} onError={() => onError("drive_video_error")} />;
  return <TimedStage seconds={duration} onEnd={onEnd}><img src={url} alt="" decoding="async" onError={() => onError("drive_image_error")} /></TimedStage>;
}

async function fetchDriveAsset(media: ManifestItem["media"], device: Device) {
  const cache = await caches.open("pontoview-media-v1"); const key = new Request(`${location.origin}/__pv_cache/${device.screenId}/${media.id}/${media.driveChecksum || "latest"}`); const cached = await cache.match(key); if (cached) return URL.createObjectURL(await cached.blob()); if (!navigator.onLine) throw new Error("offline");
  const response = await fetch(`${functionsUrl}/drive-media`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": device.screenId, "x-screen-token": device.token }, body: JSON.stringify({ mediaId: media.id }) });
  if (!response.ok) throw new Error("drive_media_error"); await cache.put(key, response.clone()); return URL.createObjectURL(await response.blob());
}

function YouTubeStage({ videoId, options, onEnd, onError }: { videoId: string; options: Record<string, unknown>; onEnd: () => void; onError: (detail: string) => void }) {
  const host = useRef<HTMLDivElement>(null); const player = useRef<YTPlayer | null>(null); const onEndRef = useRef(onEnd); const onErrorRef = useRef(onError);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]); useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const controls = Boolean(options?.controls); const mute = Boolean(options?.mute); const volume = Number(options?.volume ?? 100); const start = Number(options?.start || 0); const rawEnd = Number(options?.end || 0); const end = rawEnd > 0 ? rawEnd : undefined;
  useEffect(() => {
    let active = true;
    let watchdog = 0;
    let lastTime = -1;
    let lastProgressAt = Date.now();
    let lastRecoveryAt = 0;
    let failed = false;
    loadYouTubeApi().then(() => {
      if (!active || !host.current) return;
      player.current = new window.YT.Player(host.current, {
        videoId,
        playerVars: { autoplay: 1, controls: controls ? 1 : 0, mute: mute ? 1 : 0, start, end, playsinline: 1, rel: 0, loop: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(volume);
            if (mute) event.target.mute();
            event.target.playVideo();
            lastProgressAt = Date.now();
            watchdog = window.setInterval(() => {
              const current = player.current;
              if (!current || failed) return;
              const state = Number(current.getPlayerState?.() ?? -1);
              if (state === 0) return;
              const currentTime = Number(current.getCurrentTime?.() ?? 0);
              if (currentTime > lastTime + 0.25) {
                lastTime = currentTime;
                lastProgressAt = Date.now();
                return;
              }
              const stalledFor = Date.now() - lastProgressAt;
              if (stalledFor >= 20_000 && Date.now() - lastRecoveryAt >= 10_000) {
                lastRecoveryAt = Date.now();
                current.playVideo?.();
              }
              if (stalledFor >= 45_000) {
                failed = true;
                onErrorRef.current("youtube_stalled");
              }
            }, 5_000);
          },
          onStateChange: (event: any) => {
            if (event.data === 0) onEndRef.current();
            if (event.data === 1) lastProgressAt = Date.now();
            if (event.data === 2) window.setTimeout(() => player.current?.playVideo?.(), 750);
          },
          onError: (event: any) => onErrorRef.current(`youtube_${event.data}`),
        },
      });
    }).catch(() => onErrorRef.current("youtube_api_error"));
    return () => {
      active = false;
      if (watchdog) window.clearInterval(watchdog);
      const current = player.current;
      player.current = null;
      current?.destroy?.();
    };
  }, [videoId, controls, mute, volume, start, end]);
  return <div className="youtube-stage" ref={host} />;
}

let youtubePromise: Promise<void> | null = null;
function loadYouTubeApi() { if (window.YT?.Player) return Promise.resolve(); if (youtubePromise) return youtubePromise; youtubePromise = new Promise((resolve, reject) => { const previous = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); }; const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.onerror = () => reject(new Error("youtube")); document.head.appendChild(script); }); return youtubePromise; }

function AppStage({ appKey, name, organization }: { appKey: string | null; name: string; organization: PlayerManifest["organization"] }) { const [now, setNow] = useState(new Date()); useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []); if (appKey === "clock") return <div className="clock-app"><b>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b><span>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span></div>; return <div className="generic-app"><span className="player-mark"><BrandMark /></span><small>APP PONTOVIEW</small><h1>{name}</h1><p>{organization.displayName}</p></div>; }

type ForecastDay = { date: string; weather_code: number | null; condition?: string; temp_min: number | null; temp_max: number | null; precipitation_probability?: number | null; };
type WeatherData = { temperature: number | null; apparent_temperature?: number | null; humidity?: number | null; wind_speed?: number | null; weather_code?: number | null; condition?: string; name?: string; forecast?: ForecastDay[]; };

function WeatherWidget({ screenId, token, location }: { screenId: string; token: string; location: PlayerManifest["settings"]["weather_location"]; }) {
  const [data, setData] = useState<WeatherData | null>(null); const locationKey = JSON.stringify(location || {});
  useEffect(() => { let active = true; const load = () => void fetch(`${functionsUrl}/screens-weather`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": screenId, "x-screen-token": token }, body: "{}" }).then((response) => response.ok ? response.json() : null).then((result) => { if (active && result) setData(result); }).catch(() => {}); load(); const timer = window.setInterval(load, 10 * 60_000); return () => { active = false; window.clearInterval(timer); }; }, [screenId, token, locationKey]);
  const forecast = Array.isArray(data?.forecast) ? data.forecast.slice(1, 4) : [];
  return <div className="live-weather"><div className="weather-current"><WeatherGlyph code={data?.weather_code} /><span><b>{data?.temperature != null ? `${Math.round(data.temperature)}°` : "—"}</b><small className="condition">{data?.condition || "Clima"}</small><small>{data?.name || String(location?.name || "Configure a cidade")}</small>{(data?.apparent_temperature != null || data?.wind_speed != null) && <span className="weather-detail">{data?.apparent_temperature != null && <em style={{ fontStyle: "normal" }}>Sensação {Math.round(data.apparent_temperature)}°</em>}{data?.wind_speed != null && <em style={{ fontStyle: "normal", display: "inline-flex", alignItems: "center", gap: 3 }}><Wind />{Math.round(data.wind_speed)} km/h</em>}</span>}</span></div>{forecast.length > 0 && <div className="weather-forecast">{forecast.map((day) => <div className="weather-day" key={day.date} title={day.condition || "Previsão"}><small>{forecastLabel(day.date)}</small><WeatherGlyph code={day.weather_code} /><span><b>{day.temp_max != null ? `${Math.round(day.temp_max)}°` : "—"}</b><i className="min">{day.temp_min != null ? `${Math.round(day.temp_min)}°` : "—"}</i></span></div>)}</div>}</div>;
}
function WeatherGlyph({ code }: { code?: number | null }) { const value = Number(code ?? 3); const Icon = value <= 1 ? Sun : value === 2 ? CloudSun : value === 3 ? Cloud : [45, 48].includes(value) ? CloudFog : [71, 73, 75].includes(value) ? Snowflake : [95, 96, 99].includes(value) ? CloudLightning : CloudRain; return <Icon aria-hidden="true" />; }
function forecastLabel(date: string) { const parsed = new Date(`${date}T12:00:00`); if (Number.isNaN(parsed.getTime())) return "Dia"; return parsed.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); }
function SourceBadge({ source, url }: { source: string; url: string }) { const [imageFailed, setImageFailed] = useState(false); const favicon = faviconUrl(url); return <span className="news-source"><span className="news-source-icon"><Newspaper />{favicon && !imageFailed && <img src={favicon} alt="" onError={() => setImageFailed(true)} />}</span><strong>{source || "Fonte"}</strong></span>; }
function CompanySide({ logoUrl, name }: { logoUrl: string; name: string }) { const [imageFailed, setImageFailed] = useState(false); if (logoUrl && !imageFailed) return <div className="live-business business-logo"><img src={logoUrl} alt={name} onError={() => setImageFailed(true)} /></div>; return <div className="live-business"><Building2 /><span>{name}</span></div>; }
function CompanyFooter({ logoUrl, name }: { logoUrl: string; name: string }) { const [imageFailed, setImageFailed] = useState(false); if (logoUrl && !imageFailed) return <span className="footer-company"><img src={logoUrl} alt={name} onError={() => setImageFailed(true)} /></span>; return <span className="footer-company"><Building2 /><strong>{name}</strong></span>; }
function BrandMark() { const [imageFailed, setImageFailed] = useState(false); return imageFailed ? <span className="pv-brand-fallback">PV</span> : <img className="pv-brand-official" src="/assets/icon.png" alt="" onError={() => setImageFailed(true)} />; }
async function clearPlayerCache(screenId: string) { localStorage.removeItem(`pv_manifest_${screenId}`); for (const key of Object.keys(localStorage)) if (key.startsWith("pv-cache:") || key.startsWith("pv-last:")) localStorage.removeItem(key); if ("caches" in window) { const names = await caches.keys(); await Promise.all(names.filter((name) => name.startsWith("pontoview-")).map((name) => caches.delete(name))); } }
function cacheBustedUrl(rawUrl: string, revision: number) { try { const url = new URL(rawUrl, window.location.origin); if (revision > 0) url.searchParams.set("pv_reload", String(revision)); if (url.origin === window.location.origin && url.pathname.startsWith("/paineis/")) url.searchParams.set("pv_panel_version", "8"); return url.toString(); } catch { return rawUrl; } }
function sourceName(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Fonte"; } }
function faviconUrl(url: string) { try { const host = new URL(url).hostname; return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`; } catch { return ""; } }
function readDevice(): Device | null { try { const value = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null"); return value?.screenId && value?.token ? value : null; } catch { return null; } }
function readManifest(id: string): PlayerManifest | null { try { return JSON.parse(localStorage.getItem(`pv_manifest_${id}`) || "null"); } catch { return null; } }
interface YTPlayer { destroy?: () => void; playVideo?: () => void; getCurrentTime?: () => number; getPlayerState?: () => number; }
declare global {
  interface Window {
    YT: { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
    __PV_NATIVE_SESSION?: string;
    __PV_NATIVE_APP_VERSION?: string;
    __pvNativeOnEnded?: (playbackId: string) => void;
    __pvNativeOnError?: (playbackId: string, detail?: string) => void;
    __pvNativeOnDiagnostics?: (playbackId: string, payload: string) => void;
    __PV_NATIVE_DIAGNOSTICS?: Record<string, unknown>;
    PontoViewNative?: {
      getVersion: () => string;
      hasCachedVideo: (session: string, cacheKey: string) => boolean;
      hasCachedImage: (session: string, cacheKey: string) => boolean;
      preloadVideo: (session: string, streamUrl: string, cacheKey: string) => void;
      preloadImage: (session: string, streamUrl: string, cacheKey: string) => void;
      playVideo: (session: string, streamUrl: string, cacheKey: string, playbackId: string, x: number, y: number, width: number, height: number, rotation: number, viewportWidth: number, viewportHeight: number, muted: boolean, volume: number) => void;
      showImage: (session: string, streamUrl: string, cacheKey: string, playbackId: string, x: number, y: number, width: number, height: number, rotation: number, viewportWidth: number, viewportHeight: number) => void;
      updateBounds: (session: string, playbackId: string, x: number, y: number, width: number, height: number, rotation: number, viewportWidth: number, viewportHeight: number) => void;
      stopVideo: (session: string, playbackId: string) => void;
      stopImage: (session: string, playbackId: string) => void;
      getCacheStatus: (session: string) => string;
      getLocalVideoUrl: (session: string, cacheKey: string) => string;
      setAutoStart: (session: string, enabled: boolean) => void;
      syncManifest: (session: string, screenId: string, token: string, manifestJson: string) => void;
    };
  }
}

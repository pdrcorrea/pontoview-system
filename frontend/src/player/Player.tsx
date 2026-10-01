import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
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
const PLAYER_STATE_CHECK_MS = 60_000;
const BUILD_CHECK_MS = 60_000;
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
  .side-message-label { display: inline-flex; width: fit-content; align-items: center; gap: .55em; padding: .52em .72em; border-radius: .55em; background: #52697e; font-size: clamp(9px,.75vw,13px); font-weight: 800; letter-spacing: .1em; color: #fff; }
  .side-message-label svg { width: 1.2em; height: 1.2em; }
  .side-message h2 { margin: 0; font-size: clamp(20px,2vw,38px); line-height: 1.08; color: #17344f; overflow-wrap: anywhere; }
  .side-message p { margin: 0; font-size: clamp(14px,1.28vw,24px); line-height: 1.34; color: #40586d; overflow-wrap: anywhere; }
  .side-message.variant-attention .side-message-label { background: #b87824; color: #fff; }
  .side-message.variant-info .side-message-label { background: #2f6f96; color: #fff; }
  .side-message.variant-success .side-message-label { background: #34785e; color: #fff; }
  .side-message.priority-urgent .side-message-label { background: #a54535; color: #fff; }
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
  .player-lframe > footer { display: grid !important; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); align-content: stretch; }
  .player-lframe > footer.news-only { grid-template-rows: 1fr; }
  .player-lframe > footer.has-service-info.content-long { grid-template-rows: minmax(0, .72fr) minmax(0, 1.28fr); }
  .player-lframe > footer.has-service-info.content-very-long { grid-template-rows: minmax(0, .52fr) minmax(0, 1.48fr); }
  .footer-news-row, .footer-service-row { min-width: 0; min-height: 0; box-sizing: border-box; border-radius: .62em; }
  .footer-news-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: .72em;
    margin: .12em 0;
    padding: .44em .58em .44em .92em;
    border: 1px solid rgba(45,76,103,.10);
    border-radius: .62em;
    background: #ffffff;
    overflow: hidden;
  }
  .footer-news-row::before {
    content: "";
    position: absolute;
    left: .34em;
    top: 20%;
    bottom: 20%;
    width: .12em;
    border-radius: 99px;
    background: #315f86;
    opacity: .9;
  }
  .footer-news-row.headline-only { align-content: center; }
  .footer-news-row.has-details { align-content: center; }
  .footer-news-row.expanded { height: 100%; }
  .footer-news-content { min-width: 0; display: grid; gap: .22em; align-content: center; }
  .footer-news-main {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: .7em;
  }
  .footer-news-meta { min-width: 0; flex: 0 0 auto; display: flex; align-items: center; }
  .footer-news-details {
    min-width: 0;
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    padding-left: calc(1.7em + .7em);
    color: #65798b;
    font-size: .72em;
    font-weight: 480;
    line-height: 1.18;
  }
  .footer-news-row.headline-only .footer-news-details,
  .player-lframe > footer.has-service-info .footer-news-details { display: none !important; }
  .footer-news-qr {
    width: clamp(42px, 3.5vw, 66px);
    height: clamp(42px, 3.5vw, 66px);
    display: grid;
    place-items: center;
    padding: .18em;
    box-sizing: border-box;
    border-radius: .45em;
    background: rgba(49,95,134,.06);
    overflow: hidden;
    flex: 0 0 auto;
  }
  .footer-news-qr img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .player-lframe > footer.has-service-info .footer-news-qr {
    width: clamp(36px, 2.9vw, 54px);
    height: clamp(36px, 2.9vw, 54px);
    opacity: .92;
  }
  .player-lframe > footer.news-only .footer-news-row {
    font-size: 1.04em;
  }
  .player-lframe > footer.news-only .footer-news-details {
    -webkit-line-clamp: 3;
    font-size: .78em;
  }
  .footer-service-row { display: flex; align-items: center; gap: .8em; margin: .12em 0; padding: .45em .65em; border: 1px solid rgba(45,76,103,.10); background: #f6f4ef; font-size: .92em; color: #314b62; overflow: visible; }
  .footer-service-label { flex: 0 0 auto; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: .38em; padding: .44em .68em; border-radius: .5em; background: #52697e; color: #fff; font-size: .70em; font-weight: 900; letter-spacing: .06em; line-height: 1; }
  .footer-service-label svg { width: 1.02em; height: 1.02em; flex: 0 0 auto; color: currentColor !important; }
  .footer-service-label > span { display: inline !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; color: inherit !important; font: inherit !important; letter-spacing: inherit !important; line-height: inherit !important; box-shadow: none !important; }
  .footer-service-row.variant-info .footer-service-label { background: #2f6f96; color: #fff; }
  .footer-service-row.variant-attention .footer-service-label { background: #b87824; color: #fff; }
  .footer-service-row.variant-success .footer-service-label { background: #34785e; color: #fff; }
  .footer-service-row.priority-important .footer-service-label { box-shadow: inset 0 0 0 2px rgba(255,211,122,.65); }
  .footer-service-row.priority-urgent .footer-service-label { background: #a54535; color: #fff; box-shadow: 0 0 0 2px rgba(165,69,53,.18); }
  .footer-event-date { flex: 0 0 auto; display: inline-flex; align-items: center; gap: .35em; padding: .28em .55em; border-radius: .5em; background: #eef3f7; font-size: .78em; font-weight: 850; color: #315f86; }
  .footer-event-date svg { width: 1em; height: 1em; }
  .footer-service-copy { min-width: 0; flex: 1 1 auto; display: grid; gap: .12em; align-content: center; }
  .footer-service-title { display: block; color: #203b53; font-size: 1em; font-weight: 850; line-height: 1.08; }
  .footer-service-text { min-width: 0; display: block; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; line-height: 1.18; font-weight: 480; }
  .footer-service-row.content-long { font-size: .80em; }
  .footer-service-row.content-very-long { font-size: .68em; line-height: 1.12; }
  .footer-service-row.content-very-long .footer-service-label { font-size: .82em; }
  .footer-news-row .news-source { font-size: .68em; opacity: .86; }
  .footer-news-row .footer-headline { flex: 1 1 auto; min-width: 0; font-size: 1em; font-weight: 720; line-height: 1.12 !important; }
  .player-lframe.news-preset-compact .footer-news-row { font-size: .82em; }
  .player-lframe.news-preset-compact .footer-news-details { display: none; }
  .player-lframe.news-preset-compact .footer-news-qr { width: clamp(34px, 2.6vw, 48px); height: clamp(34px, 2.6vw, 48px); }
  .player-lframe.news-preset-compact .footer-headline { -webkit-line-clamp: 1 !important; white-space: nowrap !important; }
  .player-lframe.news-preset-highlight .footer-news-row { font-size: 1.08em; }
  .player-lframe.news-preset-highlight .footer-news-row .news-source { opacity: .68; font-size: .66em; }
  .player-lframe.news-preset-highlight .footer-headline { font-weight: 800; }
  .player-lframe.messages-preset-balanced .footer-service-row { font-size: .82em; }
  .player-lframe.messages-preset-compact .footer-service-row { font-size: .72em; }
  .player-lframe.messages-preset-compact .footer-service-label { min-width: auto; }
  .player-lframe > footer.has-bar-brand { position: relative; }
  .footer-brand-slot { position: absolute; top: 8%; bottom: 8%; z-index: 3; width: min(18%, 260px); display: flex; align-items: center; overflow: hidden; box-sizing: border-box; }
  .footer-brand-slot.bar_left { left: var(--pv-footer-x); justify-content: flex-start; }
  .footer-brand-slot.bar_right { right: var(--pv-footer-x); justify-content: flex-end; }
  .player-lframe > footer.has-bar-brand.bar_left .footer-news-row,
  .player-lframe > footer.has-bar-brand.bar_left .footer-service-row { padding-left: min(20%, 285px); }
  .player-lframe > footer.has-bar-brand.bar_right .footer-news-row,
  .player-lframe > footer.has-bar-brand.bar_right .footer-service-row { padding-right: min(20%, 285px); }
  .footer-brand-slot .footer-company { width: 100%; justify-content: inherit; }
  .footer-company.business-discreet, .live-business.business-discreet { opacity: .82; transform: scale(.82); transform-origin: center; }
  .player-lframe > aside .live-business.position-header,
  .player-lframe > aside .live-business.position-footer {
    position: relative !important;
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: clamp(42px, 6vh, 76px);
    flex: 0 0 auto;
    justify-content: flex-start !important;
    padding: 0 !important;
  }
  .player-lframe > aside .live-business.position-header { order: -2; }
  .player-lframe > aside .live-business.position-footer { order: 5; margin-top: auto !important; }
  .player-lframe > aside .live-business.position-header.business-logo img,
  .player-lframe > aside .live-business.position-footer.business-logo img {
    display: block !important;
    width: auto !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: clamp(34px, 6vh, 70px) !important;
    object-fit: contain !important;
    object-position: left center !important;
    flex: 0 1 auto;
  }
  .player-lframe > aside .live-business.business-logo.business-logo_name { gap: .65em; }
  .weather-alerts { display: grid; gap: .55vh; margin-top: 1.2vh; }
  .weather-alert { display: grid; grid-template-columns: 1.1em minmax(0,1fr); align-items: start; gap: .55em; padding: .65em .7em; border-radius: .65em; background: #fff4df; color: #76531d; }
  .weather-alert.level-2, .weather-alert.level-3 { background: #fff0ea; color: #8b3f2b; }
  .weather-alert > svg { width: 1.05em; height: 1.05em; margin-top: .08em; }
  .weather-alert span { min-width: 0; display: grid; gap: .18em; }
  .weather-alert b { font-size: clamp(8px,.66vw,12px); text-transform: uppercase; letter-spacing: .06em; }
  .weather-alert small { font-size: clamp(9px,.7vw,13px); line-height: 1.2; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .footer-message-label.urgent { background:#8d3d24; }
  .footer-message-label.important { background:#9a6b23; }
  .footer-company { display: flex !important; align-items: center; justify-content: center; width: 100%; height: 100%; min-width: 0; min-height: 0; gap: .7em; animation: none !important; overflow: hidden; }
  .footer-company img { display: block; width: auto !important; height: auto !important; max-width: 100% !important; max-height: 82% !important; object-fit: contain !important; object-position: center !important; flex: 0 1 auto; }
  .footer-company svg { width: 1.25em; height: 1.25em; color: #244f7e; }
  .footer-company strong { font-size: .85em; color: #244f7e; }
  .player-lframe.theme-dark > aside, .player-lframe.theme-dark > footer { background: #0c1b28 !important; color: #edf5fb !important; }
  .player-lframe.theme-dark .live-clock b, .player-lframe.theme-dark .live-clock small,
  .player-lframe.theme-dark .footer-headline, .player-lframe.theme-dark .footer-service-text,
  .player-lframe.theme-dark .footer-service-title, .player-lframe.theme-dark .footer-company strong { color: #edf5fb !important; }
  .player-lframe.theme-dark .news-source strong, .player-lframe.theme-dark .footer-service-label,
  .player-lframe.theme-dark .footer-event-date, .player-lframe.theme-dark .weather-day,
  .player-lframe.theme-dark .weather-day > small, .player-lframe.theme-dark .live-weather,
  .player-lframe.theme-dark .side-message p, .player-lframe.theme-dark .side-message h2 { color: #c8d8e5 !important; }
  .player-lframe.theme-dark .news-source-icon, .player-lframe.theme-dark .footer-event-date { background: #172b3b !important; }
  .player-lframe.theme-dark .weather-forecast, .player-lframe.theme-dark .footer-service-row { border-color: rgba(218,234,246,.16) !important; }
  .player-lframe.theme-dark .weather-alert { background: #382f1f; color: #ffe0a4; }
  .player-lframe.theme-dark .weather-alert.level-2, .player-lframe.theme-dark .weather-alert.level-3 { background: #3a2524; color: #ffc0b5; }
  .player-lframe.theme-dark .footer-news-row { background: #14232f !important; border-color: rgba(218,234,246,.13) !important; }
  .player-lframe.theme-dark .footer-news-row::before { background: #70a8d0; }
  .player-lframe.theme-dark .footer-news-details { color: #b7c9d7 !important; }
  .player-lframe.theme-dark .footer-news-qr { background: rgba(255,255,255,.07); }
  .player-lframe.theme-dark .footer-service-row { background: #1b2b37 !important; color: #eef5fa !important; }
  .player-lframe.theme-dark .footer-service-label { color: #fff !important; }
  .player-lframe.theme-dark .footer-event-date { color: #dceaf4 !important; }
  .player-lframe.theme-dark .news-source-icon svg,
  .player-lframe.theme-dark .weather-current > svg,
  .player-lframe.theme-dark .weather-day > svg,
  .player-lframe.theme-dark .weather-detail svg,
  .player-lframe.theme-dark .footer-company svg,
  .player-lframe.theme-dark .live-business svg { color: #8fc4e8 !important; }
  .player-lframe.theme-dark .weather-day .min,
  .player-lframe.theme-dark .weather-detail,
  .player-lframe.theme-dark .live-weather small,
  .player-lframe.theme-dark .live-business span { color: #d5e3ed; }
  .player-lframe.theme-dark .news-source-icon img { background: #fff; border-radius: inherit; }
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
  const syncInFlight = useRef(false);
  const stateCheckInFlight = useRef(false);
  const buildCheckInFlight = useRef(false);
  const stateKeyRef = useRef<string | null>(null);
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
  useEffect(() => {
    let active = true;
    const pulse = () => {
      if (!active) return;
      const native = nativeBridgeContext();
      if (!native) return;
      try { native.bridge.runtimePulse(native.session); } catch {}
    };
    pulse();
    const timer = window.setInterval(pulse, 8_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const checkBuild = async () => {
      if (!active || buildCheckInFlight.current) return;
      buildCheckInFlight.current = true;
      try {
        const response = await fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { version?: string };
        const remoteVersion = String(payload?.version || "");
        if (!remoteVersion || remoteVersion === __APP_VERSION__ || !active) return;
        const reloadUrl = new URL(window.location.href);
        reloadUrl.searchParams.set("pv_build", remoteVersion.slice(0, 16));
        window.location.replace(reloadUrl.toString());
      } catch {
        // Falha silenciosa: o Player continua operando e tenta novamente no próximo ciclo.
      } finally {
        buildCheckInFlight.current = false;
      }
    };
    const startup = window.setTimeout(() => void checkBuild(), 10_000);
    const timer = window.setInterval(() => void checkBuild(), BUILD_CHECK_MS);
    return () => { active = false; window.clearTimeout(startup); window.clearInterval(timer); };
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
    if (!activeDevice || syncInFlight.current) return;
    syncInFlight.current = true;
    try {
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
      const stateResult = await supabase.rpc("get_player_state", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token });
      if (!stateResult.error && stateResult.data && typeof (stateResult.data as { stateKey?: unknown }).stateKey === "string") {
        stateKeyRef.current = String((stateResult.data as { stateKey: string }).stateKey);
      }
    } finally {
      syncInFlight.current = false;
    }
  }, [activeDevice]);

  useEffect(() => {
    void sync();

    const checkState = async () => {
      if (!activeDevice || syncInFlight.current || stateCheckInFlight.current) return;
      stateCheckInFlight.current = true;
      try {
        const result = await supabase.rpc("get_player_state", { p_screen_id: activeDevice.screenId, p_token: activeDevice.token });
        if (result.error) {
          if (result.error.message.includes("INVALID_DEVICE_TOKEN")) {
            localStorage.removeItem(DEVICE_KEY);
            setDevice(null);
            activationStarted.current = false;
          }
          return;
        }

        const nextKey = String((result.data as { stateKey?: string } | null)?.stateKey || "");
        if (!nextKey) return;
        if (stateKeyRef.current === null) {
          stateKeyRef.current = nextKey;
          return;
        }
        if (nextKey !== stateKeyRef.current) await sync(true);
      } finally {
        stateCheckInFlight.current = false;
      }
    };

    const timer = window.setInterval(() => void checkState(), PLAYER_STATE_CHECK_MS);
    const online = () => { setConnected(true); void sync(true); };
    const offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [activeDevice, sync]);

  const newsCategoriesKey = (manifest?.settings?.news_categories || ["general"]).join(",");

  useEffect(() => {
    if (!activeDevice || !manifest?.settings?.widgets?.news) return;
    let active = true;

    const refreshNews = async () => {
      try {
        const response = await fetch(`${functionsUrl}/screens-news`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabasePublishableKey || "",
            "x-screen-id": activeDevice.screenId,
            "x-screen-token": activeDevice.token,
          },
          body: "{}",
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!active || !Array.isArray(result?.items) || !result.items.length) return;

        newsFetch.current = {
          key: newsCategoriesKey,
          at: Date.now(),
          items: result.items as PlayerManifest["news"],
        };

        setManifest((current) => {
          if (!current) return current;
          const next = { ...current, news: result.items as PlayerManifest["news"] };
          try { localStorage.setItem(`pv_manifest_${activeDevice.screenId}`, JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {
        // Mantém as últimas notícias válidas sem afetar a reprodução.
      }
    };

    const elapsed = Math.max(0, Date.now() - newsFetch.current.at);
    const firstDelay = Math.max(5_000, NEWS_REFRESH_MS - elapsed);
    const first = window.setTimeout(() => {
      void refreshNews();
    }, firstDelay);
    const timer = window.setInterval(() => void refreshNews(), NEWS_REFRESH_MS);

    return () => {
      active = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [activeDevice, manifest?.settings?.widgets?.news, newsCategoriesKey]);

  useEffect(() => {
    if (!manifest) return;
    const onPanelMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; requestId?: string } | null;
      if (!data || data.type !== "pv-news-request" || !data.requestId) return;
      const target = event.source as WindowProxy | null;
      if (!target) return;
      target.postMessage({
        type: "pv-news-response",
        requestId: data.requestId,
        items: Array.isArray(manifest.news) ? manifest.news : [],
      }, event.origin);
    };
    window.addEventListener("message", onPanelMessage);
    return () => window.removeEventListener("message", onPanelMessage);
  }, [manifest?.news]);

  const operating = manifest ? isWithinOperatingHours(manifest.settings?.operating_hours, manifest.organization.timezone, runtimeNow) : true;
  const item = operating ? manifest?.items[index] || null : null;
  const playbackRef = useRef<{ manifest: PlayerManifest | null; item: ManifestItem | null; index: number }>({ manifest: null, item: null, index: 0 });
  useEffect(() => { playbackRef.current = { manifest, item, index }; }, [manifest, item, index]);

  useEffect(() => {
    if (!activeDevice) return;
    const heartbeat = () => {
      const current = playbackRef.current;
      if (!current.manifest) return;
      const currentOperating = isWithinOperatingHours(
        current.manifest.settings?.operating_hours,
        current.manifest.organization.timezone,
        new Date(),
      );
      const currentItem = currentOperating ? current.item : null;
      void supabase.rpc("player_heartbeat", {
        p_screen_id: activeDevice.screenId,
        p_token: activeDevice.token,
        p_media_id: currentItem?.media.id || null,
        p_playlist_id: currentOperating ? current.manifest.playlist?.id || null : null,
        p_player_version: PLAYER_VERSION,
        p_client_info: {
          userAgent: navigator.userAgent,
          viewport: `${innerWidth}x${innerHeight}`,
          online: navigator.onLine,
          orientation: current.manifest.screen.orientation,
          operating: currentOperating,
          nativeAppVersion: window.__PV_NATIVE_APP_VERSION || null,
          nativeDiagnostics: window.__PV_NATIVE_DIAGNOSTICS || null,
        },
      });
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [activeDevice]);

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
  const widgetSettings = settings.widget_settings || {};
  const clockPreset = widgetSettings.clock?.preset || "classic";
  const weatherPreset = widgetSettings.weather?.preset || "complete";
  const newsPreset = widgetSettings.news?.preset || "editorial";
  const messagesPreset = widgetSettings.messages?.preset || "highlight";
  const brandPreset = widgetSettings.business?.preset || "logo";
  const brandPosition = widgetSettings.business?.position || "side_footer";
  const playerTheme = settings.theme || "light";
  const [clock, setClock] = useState(new Date());
  const [newsIndex, setNewsIndex] = useState(0);
  const [infoIndex, setInfoIndex] = useState(0);
  const [sideIndex, setSideIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);

  const footerMessages = useMemo(() => manifest.messages.filter((message) => (message.displayLocation || "footer") === "footer"), [manifest.messages]);
  const sideMessages = useMemo(() => manifest.messages.filter((message) => message.displayLocation === "sidebar" && (!message.contentType || message.contentType === "message")), [manifest.messages]);
  const exclusiveSideMessages = useMemo(() => sideMessages.filter((message) => message.isExclusive), [sideMessages]);
  const effectiveSideMessages = exclusiveSideMessages.length ? [exclusiveSideMessages[0]] : sideMessages;
  const weightedSideMessages = useMemo(() => effectiveSideMessages.flatMap((message) => message.priority === "urgent" ? [message, message] : [message]), [effectiveSideMessages]);

  const newsEntries = useMemo(() => settings.widgets?.news
    ? manifest.news
        .map((news) => ({ text: news.title, details: newsDetails(news.title, news.summary), source: news.source || sourceName(news.url), url: news.url }))
        .filter((entry) => entry.text)
    : [], [settings.widgets?.news, manifest.news]);

  const footerInfo = useMemo(() => settings.widgets?.messages
    ? footerMessages.filter((message) => Boolean(message.body))
    : [], [settings.widgets?.messages, footerMessages]);

  const sideSlides = useMemo(() => [
    ...(!exclusiveSideMessages.length && settings.widgets?.weather ? [{ kind: "weather" as const, key: "weather" }] : []),
    ...(settings.widgets?.messages ? weightedSideMessages.map((message, position) => ({ kind: "message" as const, key: `${message.id}-${position}`, message })) : []),
  ], [settings.widgets?.weather, settings.widgets?.messages, weightedSideMessages, exclusiveSideMessages.length]);

  useEffect(() => { setNewsIndex(0); }, [newsEntries.length]);
  useEffect(() => {
    if (newsEntries.length <= 1) return;
    const timer = window.setTimeout(() => setNewsIndex((current) => (current + 1) % newsEntries.length), 12_000);
    return () => window.clearTimeout(timer);
  }, [newsIndex, newsEntries]);

  useEffect(() => { setInfoIndex(0); }, [footerInfo.length]);
  useEffect(() => {
    if (footerInfo.length <= 1) return;
    const current = footerInfo[infoIndex % footerInfo.length];
    const timer = window.setTimeout(() => setInfoIndex((i) => (i + 1) % footerInfo.length), messageDisplayMs(current));
    return () => window.clearTimeout(timer);
  }, [infoIndex, footerInfo]);

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
  const currentNews = newsEntries.length ? newsEntries[newsIndex % newsEntries.length] : null;
  const currentInfo = footerInfo.length ? footerInfo[infoIndex % footerInfo.length] : null;
  const showNewsDetails = Boolean(currentNews?.details) && !currentInfo;
  const showNewsQr = Boolean(currentNews?.url);
  const currentSide = sideSlides.length ? sideSlides[sideIndex % sideSlides.length] : null;
  const logoUrl = String(manifest.organization.settings?.logoUrl || "");

  return <>{preloader}<main className={`player-lframe side-${settings.side_position} bar-${settings.bar_position} theme-${playerTheme} news-preset-${newsPreset} messages-preset-${messagesPreset} brand-${brandPosition}`}>
    <div className="player-main">{stage}</div>
    <aside>
      {settings.widgets?.business && brandPosition === "side_header" && <CompanySide logoUrl={logoUrl} name={manifest.organization.displayName} preset={brandPreset} position="header" />}
      {settings.widgets?.clock && <div className={`live-clock preset-${clockPreset}`}>
        <b>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(clockPreset === "editorial" ? { second: "2-digit" as const } : {}) })}</b>
        {settings.widgets?.date && clockPreset !== "minimal" && <small>{clock.toLocaleDateString("pt-BR", clockPreset === "editorial" ? { weekday: "long", day: "2-digit", month: "long" } : { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}</small>}
      </div>}
      {sideSlides.length > 0 && <div className="side-rotation-slot">
        {!exclusiveSideMessages.length && settings.widgets?.weather && <div className="side-panel-slide" hidden={currentSide?.kind !== "weather"}><WeatherWidget screenId={device.screenId} token={device.token} location={settings.weather_location} preset={weatherPreset} /></div>}
        {currentSide?.kind === "message" && <div className="side-panel-slide" key={`side-message-${currentSide.key}`}><SideMessage message={currentSide.message} /></div>}
      </div>}
      {settings.widgets?.business && brandPosition === "side_footer" && <CompanySide logoUrl={logoUrl} name={manifest.organization.displayName} preset={brandPreset} position="footer" />}
    </aside>
    <footer className={`${currentInfo ? `has-service-info ${footerLengthClass(currentInfo)}` : "news-only"} ${settings.widgets?.business && (brandPosition === "bar_left" || brandPosition === "bar_right") ? `has-bar-brand ${brandPosition}` : ""}`}>
      {settings.widgets?.business && (brandPosition === "bar_left" || brandPosition === "bar_right") && <div className={`footer-brand-slot ${brandPosition}`}><CompanyFooter logoUrl={logoUrl} name={manifest.organization.displayName} preset={brandPreset} /></div>}
      <div className={`footer-news-row ${showNewsDetails ? "has-details" : "headline-only"} ${!currentInfo ? "expanded" : ""}`}>
        {currentNews ? <>
          <div className="footer-news-content">
            <div className="footer-news-main">
              <div className="footer-news-meta"><SourceBadge source={currentNews.source} url={currentNews.url} /></div>
              <span className="footer-headline" key={`news-${newsIndex}`}>{currentNews.text}</span>
            </div>
            {showNewsDetails && <span className="footer-news-details">{currentNews.details}</span>}
          </div>
          {showNewsQr && <span className="footer-news-qr" aria-hidden="true"><img src={newsQrUrl(currentNews.url)} alt="" /></span>}
        </> : <span />}
      </div>
      {currentInfo && (
        <div className={`footer-service-row priority-${currentInfo.priority || "normal"} type-${currentInfo.contentType || "message"} variant-${currentInfo.styleVariant || "standard"} ${footerLengthClass(currentInfo)}`} key={`info-${infoIndex}`}>
          <span className="footer-service-label">{footerInfoIcon(currentInfo)}<span>{footerInfoLabel(currentInfo)}</span></span>
          {currentInfo.contentType === "event" && currentInfo.eventAt && <span className="footer-event-date"><CalendarDays /> {formatEventDate(currentInfo.eventAt)}</span>}
          <span className="footer-service-copy">
            {currentInfo.title && <strong className="footer-service-title">{currentInfo.title}</strong>}
            <span className="footer-service-text">{currentInfo.body}</span>
          </span>
        </div>
      )}
    </footer>
  </main></>;
}

function SideMessage({ message }: { message: PlayerMessage }) {
  const variant = message.styleVariant || "standard";
  const priority = message.priority || "normal";
  const Icon = variant === "attention" ? AlertTriangle : variant === "info" ? Info : variant === "success" ? CheckCircle2 : MessageSquareText;
  return <div className={`side-message variant-${variant} priority-${priority} ${message.isExclusive ? "exclusive" : ""}`}>
    <span className="side-message-label"><Icon /> {message.isExclusive ? "DESTAQUE" : messageStyleLabel(message)}</span>
    {message.title && <h2>{message.title}</h2>}<p>{message.body}</p>
  </div>;
}

function newsQrUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(url)}`;
}

function newsDetails(title: string, summary: string | null | undefined) {
  const value = String(summary || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const normalizedTitle = title.replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedSummary = value.toLowerCase();
  if (normalizedSummary === normalizedTitle) return "";
  if (normalizedSummary.startsWith(normalizedTitle) && normalizedSummary.length <= normalizedTitle.length + 20) return "";
  return value;
}

function footerInfoIcon(message: PlayerMessage) {
  const variant = message.styleVariant || "standard";
  const Icon = variant === "attention" ? AlertTriangle : variant === "info" ? Info : variant === "success" ? CheckCircle2 : MessageSquareText;
  return <Icon aria-hidden="true" />;
}

function footerLengthClass(message: PlayerMessage) {
  const length = `${message.title || ""} ${message.body || ""}`.trim().length;
  if (length > 300) return "content-very-long";
  if (length > 180) return "content-long";
  return "content-normal";
}

function messageStyleLabel(message: PlayerMessage) {
  if (message.priority === "urgent") return "URGENTE";
  if (message.styleVariant === "attention") return "ATENÇÃO";
  if (message.styleVariant === "info") return "INFORMATIVO";
  if (message.styleVariant === "success") return "POSITIVO";
  if (message.priority === "important") return "IMPORTANTE";
  return "MENSAGEM";
}

function footerInfoLabel(message: PlayerMessage) {
  if (message.contentType === "event") return "AGENDA";
  if (message.contentType === "local_info" && (!message.styleVariant || message.styleVariant === "standard")) return "INFORMAÇÃO";
  if (message.contentType === "message") return messageStyleLabel(message);
  if (message.styleVariant && message.styleVariant !== "standard") return messageStyleLabel(message);
  return "INFORMAÇÃO";
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
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

const driveCacheWarms = new Map<string, Promise<void>>();

function driveAssetKey(media: ManifestItem["media"], device: Device) {
  return `${device.screenId}:${media.id}:${media.driveChecksum || media.driveModifiedTime || "latest"}`;
}

function driveCacheRequest(media: ManifestItem["media"], device: Device) {
  return new Request(`${location.origin}/__pv_cache/${device.screenId}/${media.id}/${media.driveChecksum || media.driveModifiedTime || "latest"}`);
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

async function warmDriveCache(media: ManifestItem["media"], device: Device) {
  if (!navigator.onLine || !("caches" in window)) return;
  const warmKey = driveAssetKey(media, device);
  const existing = driveCacheWarms.get(warmKey);
  if (existing) return existing;

  const promise = (async () => {
    const cache = await caches.open("pontoview-media-v1");
    const request = driveCacheRequest(media, device);
    if (await cache.match(request)) return;

    const response = await fetch(`${functionsUrl}/drive-media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabasePublishableKey || "",
        "x-screen-id": device.screenId,
        "x-screen-token": device.token,
      },
      body: JSON.stringify({ mediaId: media.id, action: "cache" }),
    });
    if (!response.ok) return;

    const size = Number(response.headers.get("content-length") || 0);
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (size > 0 && estimate?.quota && estimate?.usage != null && estimate.usage + size > estimate.quota * 0.85) return;
    } catch {}

    await cache.put(request, response.clone());

    const prefix = `${location.origin}/__pv_cache/${device.screenId}/${media.id}/`;
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((candidate) => candidate.url.startsWith(prefix) && candidate.url !== request.url)
        .map((candidate) => cache.delete(candidate)),
    );
  })().catch(() => {}).finally(() => {
    driveCacheWarms.delete(warmKey);
  });

  driveCacheWarms.set(warmKey, promise);
  return promise;
}

function consumeDriveAsset(media: ManifestItem["media"], device: Device) {
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

    void warmDriveCache(media, device);
    return () => {
      active = false;
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
    let lastFrameAt = Date.now();
    let recoveryStep = 0;
    let frameCallbackId: number | null = null;
    let hardDeadline = Date.now() + 30 * 60_000;
    let failed = false;

    const failAndAdvance = (detail: string) => {
      if (failed) return;
      failed = true;
      try { native.bridge.clearVideoPulse(native.session); } catch {}
      onErrorRef.current(detail);
    };

    const armFrameWatch = () => {
      const video = videoRef.current as (HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      }) | null;
      if (!video?.requestVideoFrameCallback) return;

      const onFrame = () => {
        if (failed) return;
        lastFrameAt = Date.now();
        frameCallbackId = video.requestVideoFrameCallback?.(onFrame) ?? null;
      };
      frameCallbackId = video.requestVideoFrameCallback(onFrame);
    };

    const video = videoRef.current;
    if (video) {
      const setDeadline = () => {
        const duration = Number(video.duration);
        if (Number.isFinite(duration) && duration > 0) {
          hardDeadline = Date.now() + Math.max(60_000, (duration + 45) * 1000);
        }
      };
      video.addEventListener("loadedmetadata", setDeadline);
      setDeadline();
    }

    armFrameWatch();

    const watchdog = window.setInterval(() => {
      const currentVideo = videoRef.current;
      if (!currentVideo || currentVideo.ended || failed) return;

      const now = Date.now();
      const current = Number(currentVideo.currentTime || 0);
      try { native.bridge.videoPulse(native.session, media.id, current, true); } catch {}

      if (current > lastTime + 0.12) {
        lastTime = current;
        lastProgressAt = now;
      }

      const supportsFrameWatch = typeof (currentVideo as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === "function";
      const visualProgressAt = supportsFrameWatch ? Math.max(lastProgressAt, lastFrameAt) : lastProgressAt;
      const stalledFor = now - visualProgressAt;

      if (now >= hardDeadline) {
        failAndAdvance("android_video_deadline_exceeded");
        return;
      }

      if (stalledFor >= 6_000 && recoveryStep === 0) {
        recoveryStep = 1;
        currentVideo.muted = true;
        setAutoplayMuted(true);
        void currentVideo.play().catch(() => {});
        return;
      }

      if (stalledFor >= 12_000 && recoveryStep === 1) {
        recoveryStep = 2;
        const resumeAt = current;
        try {
          currentVideo.pause();
          const resume = () => {
            try {
              if (Number.isFinite(resumeAt) && resumeAt > 0) currentVideo.currentTime = resumeAt;
              currentVideo.muted = true;
              setAutoplayMuted(true);
              void currentVideo.play().catch(() => {});
            } catch {}
          };
          currentVideo.addEventListener("loadedmetadata", resume, { once: true });
          currentVideo.load();
        } catch {}
        return;
      }

      if (stalledFor >= 22_000) {
        failAndAdvance("android_local_video_stalled");
      }
    }, 2_000);

    return () => {
      window.clearInterval(watchdog);
      try { native.bridge.clearVideoPulse(native.session); } catch {}
      const currentVideo = videoRef.current as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
      if (frameCallbackId !== null) currentVideo?.cancelVideoFrameCallback?.(frameCallbackId);
    };
  }, [url, fallback, media.id, native.session]);

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
          video.muted = true;
          setAutoplayMuted(true);
          video.load();
          void video.play().catch(() => {});
          return;
        } catch {}
      }
    }
    try { native.bridge.clearVideoPulse(native.session); } catch {}
    onErrorRef.current("android_local_video_error");
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
    onEnded={() => {
      try { native.bridge.clearVideoPulse(native.session); } catch {}
      onEnd();
    }}
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
      if (stalledFor >= 10_000 && !recoveryAttempted) {
        recoveryAttempted = true;
        void video.play().catch(() => {});
      }
      if (stalledFor >= 22_000) {
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
  const cache = await caches.open("pontoview-media-v1");
  const key = driveCacheRequest(media, device);
  const cached = await cache.match(key);
  if (cached) return URL.createObjectURL(await cached.blob());
  if (!navigator.onLine) throw new Error("offline");

  if (media.type === "drive_video") void warmDriveCache(media, device);

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

  const isStreamTicket = response.headers.get("X-PontoView-Stream-Ticket") === "1";
  if (!isStreamTicket) await cache.put(key, response.clone());
  return URL.createObjectURL(await response.blob());
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

function AppStage({ appKey, name, organization }: { appKey: string | null; name: string; organization: PlayerManifest["organization"] }) { const [now, setNow] = useState(new Date()); useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []); if (appKey === "clock") return <div className="clock-app"><b>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b><span>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span></div>; if (appKey === "outubro_rosa") return <iframe src="/paineis/outubro-rosa/" title="Outubro Rosa" sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#fff9fb" }} />; return <div className="generic-app"><span className="player-mark"><BrandMark /></span><small>APP PONTOVIEW</small><h1>{name}</h1><p>{organization.displayName}</p></div>; }

type ForecastDay = { date: string; weather_code: number | null; condition?: string; temp_min: number | null; temp_max: number | null; precipitation_probability?: number | null; };
type WeatherAlert = { id?: string | number | null; title?: string; severity?: string; level?: number; description?: string; ends_at?: string | null; };
type WeatherData = { temperature: number | null; apparent_temperature?: number | null; humidity?: number | null; wind_speed?: number | null; weather_code?: number | null; condition?: string; name?: string; forecast?: ForecastDay[]; alerts?: WeatherAlert[]; };

function WeatherWidget({ screenId, token, location, preset = "complete" }: { screenId: string; token: string; location: PlayerManifest["settings"]["weather_location"]; preset?: string; }) {
  const [data, setData] = useState<WeatherData | null>(null); const locationKey = JSON.stringify(location || {});
  useEffect(() => { let active = true; const load = () => void fetch(`${functionsUrl}/screens-weather`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabasePublishableKey || "", "x-screen-id": screenId, "x-screen-token": token }, body: "{}" }).then((response) => response.ok ? response.json() : null).then((result) => { if (active && result) setData(result); }).catch(() => {}); load(); const timer = window.setInterval(load, 10 * 60_000); return () => { active = false; window.clearInterval(timer); }; }, [screenId, token, locationKey]);
  const forecast = Array.isArray(data?.forecast) ? data.forecast.slice(1, 4) : [];
  const alerts = Array.isArray(data?.alerts) ? data.alerts.slice(0, 2) : [];
  return <div className="live-weather"><div className="weather-current"><WeatherGlyph code={data?.weather_code} /><span><b>{data?.temperature != null ? `${Math.round(data.temperature)}°` : "—"}</b><small className="condition">{data?.condition || "Clima"}</small><small>{data?.name || String(location?.name || "Configure a cidade")}</small>{preset === "complete" && (data?.apparent_temperature != null || data?.wind_speed != null) && <span className="weather-detail">{data?.apparent_temperature != null && <em style={{ fontStyle: "normal" }}>Sensação {Math.round(data.apparent_temperature)}°</em>}{data?.wind_speed != null && <em style={{ fontStyle: "normal", display: "inline-flex", alignItems: "center", gap: 3 }}><Wind />{Math.round(data.wind_speed)} km/h</em>}</span>}</span></div>{alerts.length > 0 && <div className="weather-alerts">{alerts.map((alert, position) => <div className={`weather-alert level-${Number(alert.level || 0)}`} key={String(alert.id ?? position)}><AlertTriangle /><span><b>{alert.severity || "Alerta meteorológico"}</b><small>{alert.title || alert.description || "Atenção às condições do tempo"}</small></span></div>)}</div>}{preset !== "essential" && forecast.length > 0 && <div className="weather-forecast">{forecast.map((day) => <div className="weather-day" key={day.date} title={day.condition || "Previsão"}><small>{forecastLabel(day.date)}</small><WeatherGlyph code={day.weather_code} /><span><b>{day.temp_max != null ? `${Math.round(day.temp_max)}°` : "—"}</b><i className="min">{day.temp_min != null ? `${Math.round(day.temp_min)}°` : "—"}</i></span></div>)}</div>}</div>;
}
function WeatherGlyph({ code }: { code?: number | null }) { const value = Number(code ?? 3); const Icon = value <= 1 ? Sun : value === 2 ? CloudSun : value === 3 ? Cloud : [45, 48].includes(value) ? CloudFog : [71, 73, 75].includes(value) ? Snowflake : [95, 96, 99].includes(value) ? CloudLightning : CloudRain; return <Icon aria-hidden="true" />; }
function forecastLabel(date: string) { const parsed = new Date(`${date}T12:00:00`); if (Number.isNaN(parsed.getTime())) return "Dia"; return parsed.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); }
function SourceBadge({ source, url }: { source: string; url: string }) { const [imageFailed, setImageFailed] = useState(false); const favicon = faviconUrl(url); return <span className="news-source"><span className="news-source-icon"><Newspaper />{favicon && !imageFailed && <img src={favicon} alt="" onError={() => setImageFailed(true)} />}</span><strong>{source || "Fonte"}</strong></span>; }
function CompanySide({ logoUrl, name, preset = "logo", position = "footer" }: { logoUrl: string; name: string; preset?: string; position?: "header" | "footer" }) { const [imageFailed, setImageFailed] = useState(false); const showName = preset === "logo_name" || !logoUrl || imageFailed; return <div className={`live-business business-${preset} position-${position} ${logoUrl && !imageFailed ? "business-logo" : ""}`}>{logoUrl && !imageFailed ? <img src={logoUrl} alt={name} onError={() => setImageFailed(true)} /> : <Building2 />}{showName && <span>{name}</span>}</div>; }
function CompanyFooter({ logoUrl, name, preset = "logo" }: { logoUrl: string; name: string; preset?: string }) { const [imageFailed, setImageFailed] = useState(false); const showName = preset === "logo_name" || !logoUrl || imageFailed; return <span className={`footer-company business-${preset}`}>{logoUrl && !imageFailed ? <img src={logoUrl} alt={name} onError={() => setImageFailed(true)} /> : <Building2 />}{showName && <strong>{name}</strong>}</span>; }
function BrandMark() { const [imageFailed, setImageFailed] = useState(false); return imageFailed ? <span className="pv-brand-fallback">PV</span> : <img className="pv-brand-official" src="/assets/icon.png" alt="" onError={() => setImageFailed(true)} />; }
async function clearPlayerCache(screenId: string) { localStorage.removeItem(`pv_manifest_${screenId}`); for (const key of Object.keys(localStorage)) if (key.startsWith("pv-cache:") || key.startsWith("pv-last:")) localStorage.removeItem(key); if ("caches" in window) { const names = await caches.keys(); await Promise.all(names.filter((name) => name.startsWith("pontoview-")).map((name) => caches.delete(name))); } }
function cacheBustedUrl(rawUrl: string, revision: number) { try { const url = new URL(rawUrl, window.location.origin); if (revision > 0) url.searchParams.set("pv_reload", String(revision)); if (url.origin === window.location.origin && url.pathname.startsWith("/paineis/")) url.searchParams.set("pv_panel_version", "9"); return url.toString(); } catch { return rawUrl; } }
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
      runtimePulse: (session: string) => void;
      videoPulse: (session: string, mediaId: string, positionSeconds: number, active: boolean) => void;
      clearVideoPulse: (session: string) => void;
      setAutoStart: (session: string, enabled: boolean) => void;
      syncManifest: (session: string, screenId: string, token: string, manifestJson: string) => void;
    };
  }
}

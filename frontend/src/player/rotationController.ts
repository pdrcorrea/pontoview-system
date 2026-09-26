import type { ScreenRotation } from "../types";

const DEVICE_KEY = "pontoview_player_device_v1";
const ROTATION_KEY = "pontoview_player_rotation_v1";
const MANIFEST_KEY_PREFIX = "pv_manifest_";
const PLAYER_PATH = "/player";
const DEDICATED_PLAYER_HOSTS = new Set(["tv.pontoview.com.br"]);

type Device = { screenId: string; token: string };

function isPlayerSurface() {
  return location.pathname.startsWith(PLAYER_PATH) || DEDICATED_PLAYER_HOSTS.has(location.hostname.toLowerCase());
}

function readDevice(): Device | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
    return value?.screenId && value?.token ? value : null;
  } catch {
    return null;
  }
}

function normalizeRotation(value: unknown): ScreenRotation {
  return value === "right" || value === "left" || value === "180" ? value : "standard";
}

function cacheRotation(screenId: string, rotation: ScreenRotation) {
  try { localStorage.setItem(ROTATION_KEY, JSON.stringify({ screenId, rotation })); } catch { /* sem armazenamento */ }
}

function readCachedRotation(screenId: string): ScreenRotation {
  try {
    const manifest = JSON.parse(localStorage.getItem(`${MANIFEST_KEY_PREFIX}${screenId}`) || "null");
    if (manifest?.screen) {
      const rotation = normalizeRotation(manifest.screen.rotation);
      cacheRotation(screenId, rotation);
      return rotation;
    }
  } catch { /* usa o cache legado abaixo */ }

  try {
    const value = JSON.parse(localStorage.getItem(ROTATION_KEY) || "null");
    return value?.screenId === screenId ? normalizeRotation(value.rotation) : "standard";
  } catch {
    return "standard";
  }
}

function setImportant(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "important") return;
  element.style.setProperty(property, value, "important");
}

function applyRotation(rotation: ScreenRotation) {
  const runtime = document.querySelector<HTMLElement>(".pv-player-runtime");
  if (!runtime) return;

  setImportant(runtime, "position", "fixed");
  setImportant(runtime, "right", "auto");
  setImportant(runtime, "bottom", "auto");
  setImportant(runtime, "transform-origin", "center center");

  if (rotation === "right" || rotation === "left") {
    setImportant(runtime, "width", "100vh");
    setImportant(runtime, "height", "100vw");
    setImportant(runtime, "left", "50%");
    setImportant(runtime, "top", "50%");
    setImportant(runtime, "transform", `translate(-50%, -50%) rotate(${rotation === "right" ? "90deg" : "-90deg"})`);
    return;
  }

  setImportant(runtime, "width", "100vw");
  setImportant(runtime, "height", "100vh");
  setImportant(runtime, "left", "0px");
  setImportant(runtime, "top", "0px");
  setImportant(runtime, "transform", rotation === "180" ? "rotate(180deg)" : "none");
}

function startRotationController() {
  if (!isPlayerSurface()) return;

  let device: Device | null = null;
  let rotation: ScreenRotation = "standard";

  const syncDevice = () => {
    const nextDevice = readDevice();
    if (!nextDevice) {
      device = null;
      rotation = "standard";
      return;
    }

    const changedDevice = !device || device.screenId !== nextDevice.screenId || device.token !== nextDevice.token;
    device = nextDevice;

    const cached = readCachedRotation(device.screenId);
    if (changedDevice || cached !== rotation) rotation = cached;
    applyRotation(rotation);
  };

  syncDevice();
  const applyTimer = window.setInterval(syncDevice, 1000);
  const onResize = () => applyRotation(rotation);
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(applyTimer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  }, { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startRotationController, { once: true });
} else {
  startRotationController();
}

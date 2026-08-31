import { supabase } from "../lib/supabase";
import type { ScreenRotation } from "../types";

const DEVICE_KEY = "pontoview_player_device_v1";
const ROTATION_KEY = "pontoview_player_rotation_v1";

type Device = { screenId: string; token: string };

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

function readCachedRotation(screenId: string): ScreenRotation {
  try {
    const value = JSON.parse(localStorage.getItem(ROTATION_KEY) || "null");
    return value?.screenId === screenId ? normalizeRotation(value.rotation) : "standard";
  } catch {
    return "standard";
  }
}

function cacheRotation(screenId: string, rotation: ScreenRotation) {
  try { localStorage.setItem(ROTATION_KEY, JSON.stringify({ screenId, rotation })); } catch { /* sem armazenamento */ }
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

async function refreshRotation(device: Device) {
  const result = await supabase.rpc("get_player_manifest", {
    p_screen_id: device.screenId,
    p_token: device.token,
  });
  if (result.error || !result.data) return;
  const rotation = normalizeRotation((result.data as any)?.screen?.rotation);
  cacheRotation(device.screenId, rotation);
  applyRotation(rotation);
}

function startRotationController() {
  if (!location.pathname.startsWith("/player")) return;
  const device = readDevice();
  if (!device) return;

  let rotation = readCachedRotation(device.screenId);
  applyRotation(rotation);

  const applyTimer = window.setInterval(() => {
    const next = readCachedRotation(device.screenId);
    if (next !== rotation) rotation = next;
    applyRotation(rotation);
  }, 1000);

  const refresh = () => void refreshRotation(device).then(() => {
    rotation = readCachedRotation(device.screenId);
    applyRotation(rotation);
  });
  refresh();
  const syncTimer = window.setInterval(refresh, 15000);
  window.addEventListener("resize", () => applyRotation(rotation));

  window.addEventListener("beforeunload", () => {
    window.clearInterval(applyTimer);
    window.clearInterval(syncTimer);
  }, { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startRotationController, { once: true });
} else {
  startRotationController();
}

const PLAYER_PATH = "/player";
const DEDICATED_PLAYER_HOSTS = new Set(["tv.pontoview.com.br"]);

function isPlayerSurface() {
  return location.pathname.startsWith(PLAYER_PATH) || DEDICATED_PLAYER_HOSTS.has(location.hostname.toLowerCase());
}

function setImportant(element: HTMLElement, property: string, value: string) {
  if (
    element.style.getPropertyValue(property) === value &&
    element.style.getPropertyPriority(property) === "important"
  ) return;
  element.style.setProperty(property, value, "important");
}

function fitLogicalCanvas() {
  if (!isPlayerSurface()) return;

  const runtime = document.querySelector<HTMLElement>(".pv-player-runtime");
  const canvas = document.querySelector<HTMLElement>(".pv-orientation-canvas");
  if (!runtime || !canvas) return;

  // Preserve the canonical canvas (16:9 or 9:16) and rotate it only when the
  // configured orientation differs from the physical drawing surface.
  const availableWidth = runtime.clientWidth || window.innerWidth;
  const availableHeight = runtime.clientHeight || window.innerHeight;
  if (!availableWidth || !availableHeight) return;

  const logicalPortrait = canvas.classList.contains("logical-portrait");
  const runtimePortrait = availableHeight >= availableWidth;
  const shouldRotate = logicalPortrait !== runtimePortrait;
  const logicalAspect = logicalPortrait ? 9 / 16 : 16 / 9;

  const fitWidth = shouldRotate ? availableHeight : availableWidth;
  const fitHeight = shouldRotate ? availableWidth : availableHeight;

  let width = fitWidth;
  let height = width / logicalAspect;
  if (height > fitHeight) {
    height = fitHeight;
    width = height * logicalAspect;
  }

  setImportant(canvas, "position", "absolute");
  setImportant(canvas, "width", `${Math.round(width)}px`);
  setImportant(canvas, "height", `${Math.round(height)}px`);
  setImportant(canvas, "left", "50%");
  setImportant(canvas, "top", "50%");
  setImportant(canvas, "right", "auto");
  setImportant(canvas, "bottom", "auto");
  setImportant(canvas, "max-width", "none");
  setImportant(canvas, "max-height", "none");
  setImportant(canvas, "aspect-ratio", logicalPortrait ? "9 / 16" : "16 / 9");
  setImportant(
    canvas,
    "transform",
    shouldRotate ? "translate(-50%, -50%) rotate(90deg)" : "translate(-50%, -50%)",
  );
  setImportant(canvas, "transform-origin", "center center");
}

function startOrientationController() {
  if (!isPlayerSurface()) return;

  let frame = 0;
  const scheduleFit = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(fitLogicalCanvas);
  };

  scheduleFit();
  window.addEventListener("resize", scheduleFit);
  window.addEventListener("orientationchange", scheduleFit);

  const observer = new MutationObserver(scheduleFit);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  // Some TV browsers report their final viewport a moment after boot. Keep a
  // lightweight safety pass so the canonical canvas settles correctly.
  const timer = window.setInterval(scheduleFit, 1000);

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    window.clearInterval(timer);
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", scheduleFit);
    window.removeEventListener("orientationchange", scheduleFit);
  }, { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startOrientationController, { once: true });
} else {
  startOrientationController();
}

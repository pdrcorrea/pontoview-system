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

  const portrait = canvas.classList.contains("logical-portrait");
  const logicalAspect = portrait ? 9 / 16 : 16 / 9;

  // The runtime may itself have been rotated to compensate for a TV mounted
  // physically on its side. clientWidth/clientHeight give us its logical,
  // pre-transform drawing area, which is exactly what the canvas must fit.
  const availableWidth = runtime.clientWidth || window.innerWidth;
  const availableHeight = runtime.clientHeight || window.innerHeight;
  if (!availableWidth || !availableHeight) return;

  let width = availableWidth;
  let height = width / logicalAspect;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * logicalAspect;
  }

  setImportant(canvas, "position", "absolute");
  setImportant(canvas, "width", `${Math.round(width)}px`);
  setImportant(canvas, "height", `${Math.round(height)}px`);
  setImportant(canvas, "left", "50%");
  setImportant(canvas, "top", "50%");

  // Orientation defines only the logical aspect ratio. It must never rotate
  // the content. Physical rotation is handled independently by the screen's
  // rotation setting.
  setImportant(canvas, "transform", "translate(-50%, -50%)");
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

  // Some TV browsers report the final viewport a moment after boot. Keep a
  // lightweight safety pass so the player settles correctly on those devices.
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

const PLAYER_PATH = "/player";

function fitLogicalCanvas() {
  if (!location.pathname.startsWith(PLAYER_PATH)) return;

  const runtime = document.querySelector<HTMLElement>(".pv-player-runtime");
  const canvas = document.querySelector<HTMLElement>(".pv-orientation-canvas");
  if (!runtime || !canvas) return;

  const portrait = canvas.classList.contains("logical-portrait");
  const logicalAspect = portrait ? 9 / 16 : 16 / 9;

  const availableWidth = runtime.clientWidth || window.innerWidth;
  const availableHeight = runtime.clientHeight || window.innerHeight;
  if (!availableWidth || !availableHeight) return;

  let width = availableWidth;
  let height = width / logicalAspect;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * logicalAspect;
  }

  canvas.style.setProperty("width", `${Math.round(width)}px`, "important");
  canvas.style.setProperty("height", `${Math.round(height)}px`, "important");
  canvas.style.setProperty("left", "50%", "important");
  canvas.style.setProperty("top", "50%", "important");
  canvas.style.setProperty("transform", "translate(-50%, -50%)", "important");
  canvas.style.setProperty("transform-origin", "center center", "important");
}

function startOrientationController() {
  if (!location.pathname.startsWith(PLAYER_PATH)) return;

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
    attributeFilter: ["class", "style"],
  });

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

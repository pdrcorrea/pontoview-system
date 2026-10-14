const INTERNAL_PANEL_SELECTOR = '.player-media-frame iframe';
const INTERNAL_PANEL_FRAME_CLASS = 'pv-responsive-internal-panel-frame';
const INTERNAL_PANEL_HOST_CLASS = 'pv-responsive-internal-panel-host';
const INTERNAL_PANEL_CANVAS_CLASS = 'pv-responsive-internal-panel-canvas';

function isInternalPanel(iframe: HTMLIFrameElement) {
  try {
    const url = new URL(iframe.src, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/paineis/');
  } catch {
    return false;
  }
}

function markInternalPanels() {
  const activeFrames = new Set<HTMLElement>();
  const activeHosts = new Set<HTMLElement>();
  let hasInternalPanel = false;

  document.querySelectorAll<HTMLIFrameElement>(INTERNAL_PANEL_SELECTOR).forEach((iframe) => {
    if (!isInternalPanel(iframe)) return;

    hasInternalPanel = true;
    const frame = iframe.closest<HTMLElement>('.player-media-frame');
    const host = iframe.closest<HTMLElement>('.player-media-host');

    if (frame) {
      activeFrames.add(frame);
      if (!frame.classList.contains(INTERNAL_PANEL_FRAME_CLASS)) {
        frame.classList.add(INTERNAL_PANEL_FRAME_CLASS);
      }
    }

    if (host) {
      activeHosts.add(host);
      if (!host.classList.contains(INTERNAL_PANEL_HOST_CLASS)) {
        host.classList.add(INTERNAL_PANEL_HOST_CLASS);
      }
    }
  });

  document.querySelectorAll<HTMLElement>(`.${INTERNAL_PANEL_FRAME_CLASS}`).forEach((element) => {
    if (!activeFrames.has(element)) element.classList.remove(INTERNAL_PANEL_FRAME_CLASS);
  });

  document.querySelectorAll<HTMLElement>(`.${INTERNAL_PANEL_HOST_CLASS}`).forEach((element) => {
    if (!activeHosts.has(element)) element.classList.remove(INTERNAL_PANEL_HOST_CLASS);
  });

  const canvas = document.querySelector<HTMLElement>('.pv-orientation-canvas');
  if (canvas && canvas.classList.contains(INTERNAL_PANEL_CANVAS_CLASS) !== hasInternalPanel) {
    canvas.classList.toggle(INTERNAL_PANEL_CANVAS_CLASS, hasInternalPanel);
  }
}

const style = document.createElement('style');
style.textContent = `
.pv-player-runtime .player-media-host.${INTERNAL_PANEL_HOST_CLASS}{align-items:stretch!important;justify-content:stretch!important}
.pv-player-runtime .player-media-frame.${INTERNAL_PANEL_FRAME_CLASS}{flex:1 1 auto!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}

/* Internal PontoView panels are responsive documents, not fixed-ratio media.
   Let them use the entire physical viewport instead of the canonical 16:9/9:16 canvas. */
.pv-player-runtime .pv-orientation-canvas.${INTERNAL_PANEL_CANVAS_CLASS}:not(.rotated){
  width:100vw!important;
  height:100vh!important;
  max-width:none!important;
  max-height:none!important;
  aspect-ratio:auto!important;
}
.pv-player-runtime .pv-orientation-canvas.${INTERNAL_PANEL_CANVAS_CLASS}.rotated{
  width:100vh!important;
  height:100vw!important;
  max-width:none!important;
  max-height:none!important;
  aspect-ratio:auto!important;
}
`;
document.head.appendChild(style);

let scheduled = false;
function scheduleMarkInternalPanels() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    markInternalPanels();
  });
}

const observer = new MutationObserver(() => scheduleMarkInternalPanels());
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src'],
});

window.addEventListener('resize', scheduleMarkInternalPanels, { passive: true });
window.addEventListener('orientationchange', scheduleMarkInternalPanels, { passive: true });
markInternalPanels();

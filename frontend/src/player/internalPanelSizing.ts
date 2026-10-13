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

function markInternalPanels(root: ParentNode = document) {
  document.querySelectorAll<HTMLElement>(`.${INTERNAL_PANEL_FRAME_CLASS}`).forEach((element) => element.classList.remove(INTERNAL_PANEL_FRAME_CLASS));
  document.querySelectorAll<HTMLElement>(`.${INTERNAL_PANEL_HOST_CLASS}`).forEach((element) => element.classList.remove(INTERNAL_PANEL_HOST_CLASS));

  const canvas = document.querySelector<HTMLElement>('.pv-orientation-canvas');
  let hasInternalPanel = false;

  root.querySelectorAll<HTMLIFrameElement>(INTERNAL_PANEL_SELECTOR).forEach((iframe) => {
    if (!isInternalPanel(iframe)) return;
    hasInternalPanel = true;
    iframe.closest<HTMLElement>('.player-media-frame')?.classList.add(INTERNAL_PANEL_FRAME_CLASS);
    iframe.closest<HTMLElement>('.player-media-host')?.classList.add(INTERNAL_PANEL_HOST_CLASS);
  });

  canvas?.classList.toggle(INTERNAL_PANEL_CANVAS_CLASS, hasInternalPanel);
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

const observer = new MutationObserver(() => markInternalPanels());
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','class','style']});
window.addEventListener('resize', () => markInternalPanels());
window.addEventListener('orientationchange', () => markInternalPanels());
markInternalPanels();

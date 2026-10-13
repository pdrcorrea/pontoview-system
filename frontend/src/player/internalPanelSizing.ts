const INTERNAL_PANEL_SELECTOR = '.player-media-frame iframe';
const INTERNAL_PANEL_FRAME_CLASS = 'pv-responsive-internal-panel-frame';
const INTERNAL_PANEL_HOST_CLASS = 'pv-responsive-internal-panel-host';

function isInternalPanel(iframe: HTMLIFrameElement) {
  try {
    const url = new URL(iframe.src, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/paineis/');
  } catch {
    return false;
  }
}

function markInternalPanels(root: ParentNode = document) {
  root.querySelectorAll<HTMLIFrameElement>(INTERNAL_PANEL_SELECTOR).forEach((iframe) => {
    if (!isInternalPanel(iframe)) return;
    iframe.closest<HTMLElement>('.player-media-frame')?.classList.add(INTERNAL_PANEL_FRAME_CLASS);
    iframe.closest<HTMLElement>('.player-media-host')?.classList.add(INTERNAL_PANEL_HOST_CLASS);
  });
}

const style = document.createElement('style');
style.textContent = `
.pv-player-runtime .player-media-host.${INTERNAL_PANEL_HOST_CLASS}{align-items:stretch!important;justify-content:stretch!important}
.pv-player-runtime .player-media-frame.${INTERNAL_PANEL_FRAME_CLASS}{flex:1 1 auto!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}
`;
document.head.appendChild(style);

const observer = new MutationObserver(() => markInternalPanels());
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
markInternalPanels();

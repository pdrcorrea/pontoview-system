/* PontoView Light Motion: efeito local do ponteiro, sem backend nem timers. */
const lightSelector = ".pv-home .pv-home-button, .auth-page .btn:not(.danger)";
if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.addEventListener("pointermove", (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>(lightSelector);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--x", (event.clientX - rect.left) + "px");
    element.style.setProperty("--y", (event.clientY - rect.top) + "px");
    element.style.setProperty("--pv-x", (event.clientX - rect.left) + "px");
    element.style.setProperty("--pv-y", (event.clientY - rect.top) + "px");
  }, { passive: true });
}

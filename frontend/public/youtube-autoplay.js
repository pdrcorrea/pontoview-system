(() => {
  const PATCH_FLAG = "__pvAutoplayPatched";

  function patchYouTubePlayer() {
    const yt = window.YT;
    if (!yt?.Player || yt[PATCH_FLAG]) return false;

    const NativePlayer = yt.Player;

    function PontoViewPlayer(element, config = {}) {
      const originalEvents = config.events || {};
      const originalReady = originalEvents.onReady;
      const originalStateChange = originalEvents.onStateChange;
      let fallbackTimer = null;

      const clearFallback = () => {
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };

      const player = new NativePlayer(element, {
        ...config,
        playerVars: {
          ...(config.playerVars || {}),
          autoplay: 1,
          playsinline: 1,
        },
        events: {
          ...originalEvents,
          onReady(event) {
            originalReady?.(event);

            // Keep the configured audio preference first. If the browser blocks
            // audible autoplay, retry muted so signage never waits for a play click.
            try {
              event.target.playVideo?.();
            } catch {
              // The muted fallback below handles restrictive WebViews/browsers.
            }

            fallbackTimer = window.setTimeout(() => {
              try {
                const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
                const state = event.target.getPlayerState?.();
                if (state !== playingState) {
                  event.target.mute?.();
                  event.target.playVideo?.();
                }
              } catch {
                // Leave error handling to the Player component.
              }
            }, 900);
          },
          onStateChange(event) {
            const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
            if (event.data === playingState) clearFallback();
            originalStateChange?.(event);
          },
        },
      });

      return player;
    }

    PontoViewPlayer.prototype = NativePlayer.prototype;
    Object.setPrototypeOf(PontoViewPlayer, NativePlayer);
    yt.Player = PontoViewPlayer;
    yt[PATCH_FLAG] = true;
    return true;
  }

  const previousReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
    patchYouTubePlayer();
    previousReady?.();
  };

  const poll = window.setInterval(() => {
    if (patchYouTubePlayer()) window.clearInterval(poll);
  }, 50);
  window.setTimeout(() => window.clearInterval(poll), 15000);
})();

(() => {
  const PATCH_FLAG = "__pvAutoplayPatched";
  const DEVICE_KEY = "pontoview_player_device_v1";

  function playlistEndForVideo(videoId, startAt) {
    try {
      const device = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
      if (!device?.screenId) return null;

      const manifest = JSON.parse(
        localStorage.getItem(`pv_manifest_${device.screenId}`) || "null",
      );
      if (!Array.isArray(manifest?.items)) return null;

      const durations = manifest.items
        .filter(
          (item) =>
            item?.media?.type === "youtube" &&
            item?.media?.youtubeVideoId === videoId,
        )
        .map((item) => Number(item?.durationSeconds || item?.media?.durationSeconds || 0))
        .filter((duration) => Number.isFinite(duration) && duration > 0);

      if (!durations.length) return null;

      // The YouTube constructor only receives the video ID, not the playlist-item ID.
      // If the same video is intentionally used with different durations, do not guess
      // which occurrence is active. Preserve the original behavior in that rare case.
      const uniqueDurations = [...new Set(durations)];
      if (uniqueDurations.length !== 1) return null;

      const start = Number.isFinite(startAt) && startAt > 0 ? startAt : 0;
      return start + uniqueDurations[0];
    } catch {
      return null;
    }
  }

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

      const originalPlayerVars = config.playerVars || {};
      const start = Number(originalPlayerVars.start || 0);
      const configuredEnd = Number(originalPlayerVars.end || 0);
      const playlistEnd = playlistEndForVideo(config.videoId, start);
      const effectiveEnd = playlistEnd != null
        ? configuredEnd > 0
          ? Math.min(configuredEnd, playlistEnd)
          : playlistEnd
        : configuredEnd > 0
          ? configuredEnd
          : undefined;

      const player = new NativePlayer(element, {
        ...config,
        playerVars: {
          ...originalPlayerVars,
          autoplay: 1,
          playsinline: 1,
          ...(effectiveEnd != null ? { end: effectiveEnd } : {}),
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

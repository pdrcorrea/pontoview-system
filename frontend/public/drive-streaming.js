(() => {
  const MEDIA_CACHE = "pontoview-media-v1";
  const MIME_PREFIX = "application/x-pontoview-drive-ticket";
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = window.caches?.open?.bind(window.caches);
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const ticketUrls = new Map();
  const activeStreamUrls = new Set();
  const autoplayTimers = new WeakMap();

  // PontoView reads Drive media on demand. Never retain a local media cache.
  if (window.caches?.delete) void window.caches.delete(MEDIA_CACHE).catch(() => {});

  // Retire the previous Service Worker bridge. Native <video> Range requests are
  // more reliable on Smart TVs, Chromium kiosks and Android WebViews.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(
        registrations
          .filter((registration) => {
            const candidates = [registration.active, registration.waiting, registration.installing].filter(Boolean);
            return candidates.some((worker) => worker.scriptURL.includes("/drive-stream-worker.js"));
          })
          .map((registration) => registration.unregister()),
      ),
    ).catch(() => {});
  }

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input?.url || "";
  }

  function isDriveMediaRequest(url) {
    return /\/functions\/v1\/drive-media(?:$|[?#])/.test(url) || /\/drive-media(?:$|[?#])/.test(url);
  }

  function requestHeaders(input, init) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers || {}).forEach((value, key) => headers.set(key, value));
    return headers;
  }

  function isDriveVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return false;
    const src = String(video.currentSrc || video.src || "");
    return /\/functions\/v1\/drive-media\?ticket=/.test(src);
  }

  async function ensureDriveVideoPlaying(video, allowMutedFallback = true) {
    if (!isDriveVideo(video) || video.ended) return;

    try {
      await video.play();
      return;
    } catch {
      if (!allowMutedFallback) return;
    }

    // Browsers and TV WebViews commonly block unattended autoplay with sound.
    // Signage must keep moving, so retry muted only when the audible attempt fails.
    video.muted = true;
    video.defaultMuted = true;
    try {
      await video.play();
    } catch {
      // A later loadeddata/canplay/visibility event will retry.
    }
  }

  function scheduleAutoplay(video, delay = 0, mutedFallback = true) {
    const previous = autoplayTimers.get(video);
    if (previous) window.clearTimeout(previous);

    const timer = window.setTimeout(() => {
      autoplayTimers.delete(video);
      void ensureDriveVideoPlaying(video, mutedFallback);
    }, delay);
    autoplayTimers.set(video, timer);
  }

  function handleDriveVideoReady(event) {
    const video = event.target;
    if (!isDriveVideo(video)) return;
    scheduleAutoplay(video, 0, true);
    window.setTimeout(() => {
      if (isDriveVideo(video) && video.paused && !video.ended) {
        scheduleAutoplay(video, 0, true);
      }
    }, 900);
  }

  for (const eventName of ["loadedmetadata", "loadeddata", "canplay"]) {
    document.addEventListener(eventName, handleDriveVideoReady, true);
  }

  // Some embedded Chromium/Android TV engines load the first frame and then
  // leave the element paused without surfacing an error. Recover automatically.
  document.addEventListener("pause", (event) => {
    const video = event.target;
    if (!isDriveVideo(video) || video.ended || video.readyState < 2) return;
    scheduleAutoplay(video, 250, true);
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const video of document.querySelectorAll("video")) {
      if (isDriveVideo(video) && video.paused && !video.ended) {
        scheduleAutoplay(video, 0, true);
      }
    }
  });

  if (nativeOpen) {
    window.caches.open = async function patchedOpen(name) {
      const cache = await nativeOpen(name);
      if (name !== MEDIA_CACHE) return cache;
      return new Proxy(cache, {
        get(target, prop) {
          if (prop === "match") return async () => undefined;
          if (prop === "put" || prop === "add" || prop === "addAll") return async () => undefined;
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
  }

  window.fetch = async function patchedFetch(input, init) {
    const url = requestUrl(input);
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!isDriveMediaRequest(url) || method !== "POST") return nativeFetch(input, init);

    try {
      const originalBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const mediaId = String(originalBody?.mediaId || "");
      if (!mediaId || originalBody?.action === "ticket") return nativeFetch(input, init);

      const headers = requestHeaders(input, init);
      const ticketResponse = await nativeFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ mediaId, action: "ticket" }),
        cache: "no-store",
      });

      if (!ticketResponse.ok) return nativeFetch(input, init);
      const ticket = await ticketResponse.json();

      // Images keep the simple transient Blob path, but the PontoView cache is
      // disabled above. Videos use a native URL so the media engine owns Range.
      if (!String(ticket?.mimeType || "").toLowerCase().startsWith("video/") || !ticket?.streamUrl) {
        return nativeFetch(input, init);
      }

      const key = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      ticketUrls.set(key, String(ticket.streamUrl));

      return new Response("PontoView native Drive stream", {
        status: 200,
        headers: {
          "Content-Type": `${MIME_PREFIX}; key=${key}`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return nativeFetch(input, init);
    }
  };

  URL.createObjectURL = function patchedCreateObjectURL(value) {
    if (value instanceof Blob && value.type.startsWith(MIME_PREFIX)) {
      const match = value.type.match(/key=([^;\s]+)/i);
      const key = match?.[1];
      const streamUrl = key ? ticketUrls.get(key) : null;
      if (streamUrl) {
        ticketUrls.delete(key);
        activeStreamUrls.add(streamUrl);
        return streamUrl;
      }
    }
    return nativeCreateObjectURL(value);
  };

  URL.revokeObjectURL = function patchedRevokeObjectURL(value) {
    if (typeof value === "string" && activeStreamUrls.has(value)) {
      activeStreamUrls.delete(value);
      return;
    }
    nativeRevokeObjectURL(value);
  };
})();

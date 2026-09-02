(() => {
  const MEDIA_CACHE = "pontoview-media-v1";
  const STREAM_PREFIX = "/__pv_drive_stream/";
  const MIME_PREFIX = "application/x-pontoview-drive-stream";
  const RELOAD_FLAG = "pv_drive_stream_sw_reload";
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = window.caches?.open?.bind(window.caches);
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const streamConfigs = new Map();
  let workerPromise = null;

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

  async function ensureWorkerController() {
    if (!("serviceWorker" in navigator)) return null;
    if (!workerPromise) {
      workerPromise = (async () => {
        const registration = await navigator.serviceWorker.register("/drive-stream-worker.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          if (!sessionStorage.getItem(RELOAD_FLAG)) {
            sessionStorage.setItem(RELOAD_FLAG, "1");
            location.reload();
            return await new Promise(() => {});
          }
          return null;
        }
        sessionStorage.removeItem(RELOAD_FLAG);
        return navigator.serviceWorker.controller || registration.active || null;
      })().catch(() => null);
    }
    return workerPromise;
  }

  async function pushConfig(config) {
    const controller = await ensureWorkerController();
    if (!controller) return false;
    streamConfigs.set(config.key, config);
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => resolve(false), 1500);
      channel.port1.onmessage = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      controller.postMessage({ type: "pv-drive-stream-config", config }, [channel.port2]);
    });
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "pv-drive-stream-config-request") return;
    const config = streamConfigs.get(data.key);
    if (!config) return;
    navigator.serviceWorker.controller?.postMessage({
      type: "pv-drive-stream-config-response",
      requestId: data.requestId,
      config,
    });
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
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const mediaId = String(body?.mediaId || "");
      const headers = requestHeaders(input, init);
      const screenId = headers.get("x-screen-id") || "";
      const token = headers.get("x-screen-token") || "";
      const apikey = headers.get("apikey") || "";
      if (!mediaId || !screenId || !token) return nativeFetch(input, init);

      const key = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const configured = await pushConfig({ key, mediaId, screenId, token, apikey, endpoint: url, createdAt: Date.now() });
      if (!configured) return nativeFetch(input, init);

      return new Response("PontoView Drive stream", {
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
      if (match?.[1]) return `${location.origin}${STREAM_PREFIX}${encodeURIComponent(match[1])}`;
    }
    return nativeCreateObjectURL(value);
  };

  URL.revokeObjectURL = function patchedRevokeObjectURL(value) {
    if (typeof value === "string" && value.startsWith(`${location.origin}${STREAM_PREFIX}`)) return;
    nativeRevokeObjectURL(value);
  };

  void ensureWorkerController();
})();

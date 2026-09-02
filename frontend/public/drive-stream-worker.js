const STREAM_PREFIX = "/__pv_drive_stream/";
const configs = new Map();
const pendingConfig = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "pv-drive-stream-config" && data.config?.key) {
    configs.set(data.config.key, data.config);
    event.ports?.[0]?.postMessage({ ok: true });
    pruneConfigs();
    return;
  }
  if (data.type === "pv-drive-stream-config-response" && data.requestId && data.config?.key) {
    configs.set(data.config.key, data.config);
    pendingConfig.get(data.requestId)?.(data.config);
    pendingConfig.delete(data.requestId);
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(STREAM_PREFIX)) return;
  event.respondWith(streamDriveMedia(event.request, decodeURIComponent(url.pathname.slice(STREAM_PREFIX.length))));
});

async function streamDriveMedia(request, key) {
  const config = configs.get(key) || await recoverConfig(key);
  if (!config) return new Response("Stream unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });

  const headers = new Headers({
    "Content-Type": "application/json",
    "apikey": config.apikey || "",
    "x-screen-id": config.screenId,
    "x-screen-token": config.token,
  });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  try {
    const upstream = await fetch(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ mediaId: config.mediaId }),
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "no-store, max-age=0");
    responseHeaders.set("Pragma", "no-cache");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return new Response("Drive stream failed", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

async function recoverConfig(key) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: false });
  if (!windows.length) return null;

  const config = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingConfig.delete(requestId);
      resolve(null);
    }, 1200);
    pendingConfig.set(requestId, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
    for (const client of windows) client.postMessage({ type: "pv-drive-stream-config-request", key, requestId });
  });
  return config;
}

function pruneConfigs() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, config] of configs) {
    if ((config.createdAt || 0) < cutoff) configs.delete(key);
  }
}

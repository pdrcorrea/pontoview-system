// Cache exclusivo dos painéis internos. Não intercepta o app, APIs nem sites externos.
const CACHE = "pv-panels-v1";
const MAX_ENTRIES = 48;
const MAX_ITEM_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("pv-panels-") && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function store(request, response) {
  if (!response.ok || response.type !== "basic") return;
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_ITEM_BYTES) return;
  try {
    const blob = await response.clone().blob();
    if (blob.size > MAX_ITEM_BYTES) return;
    const cache = await caches.open(CACHE);
    await cache.delete(request);
    await cache.put(request, new Response(blob, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    }));
    const keys = await cache.keys();
    let total = 0;
    const sizes = [];
    for (const key of keys.slice().reverse()) {
      const value = await cache.match(key);
      const size = Number(value?.headers.get("content-length") || 0);
      sizes.push({ key, size });
      total += size;
    }
    while (sizes.length > MAX_ENTRIES || total > MAX_TOTAL_BYTES) {
      const oldest = sizes.shift();
      if (!oldest) break;
      await cache.delete(oldest.key);
      total -= oldest.size;
    }
  } catch {
    // Storage quota / private browsing: never interrupt content playback.
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/paineis/")) return;
  if (req.headers.has("authorization")) return;
  const isDocument = req.mode === "navigate" || req.destination === "document" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  if (isDocument) {
    // Network-first for fresh information; cached document only when offline.
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        if (response.ok) event.waitUntil(store(req, response.clone()));
        return response;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return Response.error();
      }
    })());
    return;
  }
  // Versioned local assets are reused without repeated requests.
  if (!["script", "style", "image", "font", "worker"].includes(req.destination)) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok) event.waitUntil(store(req, response.clone()));
    return response;
  })());
});
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = typeof payload.title === "string" ? payload.title : "PontoView Telas";
  const body = typeof payload.body === "string" ? payload.body : "Você tem uma atualização.";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/dashboard";
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: "/assets/icon.png", badge: "/assets/icon.png", tag: payload.key || undefined,
    data: { url }, renotify: false
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const href = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await clients.matchAll({type:"window",includeUncontrolled:true});
    const existing = tabs.find(c => new URL(c.url).origin === self.location.origin);
    if(existing){ await existing.focus(); if("navigate" in existing) await existing.navigate(href); }
    else await clients.openWindow(href);
  })());
});
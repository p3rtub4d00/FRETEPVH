const CACHE = "freteon-shell-v16";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/",
          "/assets/logo.png",
          "/assets/icon-192.png",
          "/assets/icon-512.png",
          "/manifest.webmanifest",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("freteon-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await caches.match("/")
            : Response.error()),
      ),
  );
});

/**
 * Recebe notificações push enviadas pelo FreteOn. A notificação sempre é
 * visível para o usuário, inclusive no iPhone quando o PWA está instalado.
 * O payload não contém endereço, telefone ou dados bancários.
 */
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data?.json() || {}; } catch { /* push sem conteúdo */ }
    const role = ["cliente", "motorista", "master"].includes(data.role) ? data.role : "motorista";
    const path = "/" + role;
    const title = String(data.title || "Atualização no FreteOn").slice(0, 90);
    const body = String(data.body || "Abra o FreteOn para conferir.").slice(0, 180);
    const campaignId = /^[a-f0-9]{24}$/.test(String(data.campaignId || "")) ? data.campaignId : "";
    const image = campaignId && data.image === "/api/campaigns/media/" + campaignId ? data.image : undefined;

    // Atualizar a interface aberta sem exigir recarregamento manual.
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true }).catch(() => []);
    for (const tab of tabs) {
      try { tab.postMessage({ type: "FRETEON_PUSH_EVENT", role }); } catch { /* ignore */ }
    }

    await self.registration.showNotification(title, {
      body,
      icon: "/assets/icon-192.png",
      badge: "/assets/icon-192.png",
      tag: `freteon-${role}-${String(data.id || "update").slice(0, 60)}`,
      renotify: true,
      image,
      data: { path, campaignId },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = ["/cliente", "/motorista", "/master"].includes(event.notification.data?.path) ? event.notification.data.path : "/motorista";
  event.waitUntil((async () => {
    const campaignId = /^[a-f0-9]{24}$/.test(String(event.notification.data?.campaignId || "")) ? event.notification.data.campaignId : "";
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && url.pathname === targetPath) {
          await client.focus();
          client.postMessage({ type: "FRETEON_PUSH_EVENT", campaignId });
          return;
        }
      } catch { /* ignore */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetPath + (campaignId ? "?comunicado=" + campaignId : ""));
  })());
});

/* CloudHub: network-first HTML/catalogues, immutable build assets only cached first. */
const CACHE_VERSION = "cloudhub-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("wp-pwa-") || key.startsWith("cloudhub-")) &&
                key !== CACHE_VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/lielxd") ||
    url.pathname.endsWith(".php")
  )
    return;
  const immutable = url.pathname.startsWith("/assets/");
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      if (immutable) {
        const cached = await cache.match(req);
        if (cached) return cached;
      }
      try {
        const response = await fetch(req);
        if (response.ok && (immutable || req.mode === "navigate"))
          await cache.put(req, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(req);
        if (cached) return cached;
        throw error;
      }
    }),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Spinnopal — service worker
// Strategy:
//   • Navigations (HTML): network-first, fall back to cached shell.
//   • Same-origin static assets (js/css/img/font): stale-while-revalidate.
//   • Supabase / API calls: never cached — always hit network.
// Bump VERSION to invalidate old caches on deploy.

const VERSION = "v4";
const STATIC_CACHE = `spinnopal-static-${VERSION}`;
const RUNTIME_CACHE = `spinnopal-runtime-${VERSION}`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest"]).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isSupabaseOrApi(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.endsWith(".supabase.in")
  );
}

function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico|gif)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (isSupabaseOrApi(url)) return; // pass through, never cache

  // HTML navigations — network first, cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match(OFFLINE_URL));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Same-origin static — stale-while-revalidate
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })()
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

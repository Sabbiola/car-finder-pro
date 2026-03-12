const CACHE_NAME = "autodeal-v1";
const OFFLINE_URL = "/";

// Assets to cache on install (app shell)
const PRECACHE_URLS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (Supabase API, etc.)
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Network-first for API/navigation calls, cache-first for assets
  if (url.pathname.startsWith("/src/") || url.pathname.match(/\.(js|css|woff2?)$/)) {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  } else {
    // Network-first for HTML pages (navigation)
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.headers.get("accept")?.includes("text/html")) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
  }
});

// Listen for messages from the app (e.g. cache car detail pages)
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_CAR") {
    const url = event.data.url;
    if (url) {
      caches.open(CACHE_NAME).then((cache) =>
        fetch(url)
          .then((r) => {
            if (r.ok) cache.put(url, r);
          })
          .catch(() => {}),
      );
    }
  }
});

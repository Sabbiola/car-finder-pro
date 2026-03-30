/**
 * Cache governance:
 * - Bump SW_CACHE_VERSION on each release that needs cache busting.
 * - Keep the value monotonic and human-readable for rollback operations.
 */
const SW_CACHE_VERSION = "r2026-03-30-01";
const CACHE_NAMESPACE = "carfinder-pro";
const PRECACHE_NAME = `${CACHE_NAMESPACE}-precache-${SW_CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `${CACHE_NAMESPACE}-runtime-${SW_CACHE_VERSION}`;
const OFFLINE_URL = "/";
const LEGACY_CACHE_PREFIXES = ["autodeal-", "carfinder-pro-v"];

// Assets to cache on install (app shell)
const PRECACHE_URLS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const activeCaches = new Set([PRECACHE_NAME, RUNTIME_CACHE_NAME]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((cacheName) => {
            if (activeCaches.has(cacheName)) {return false;}
            if (cacheName.startsWith(`${CACHE_NAMESPACE}-`)) {return true;}
            return LEGACY_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));
          })
          .map((cacheName) => caches.delete(cacheName)),
      ),
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
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for static assets
  if (url.pathname.startsWith("/src/") || url.pathname.match(/\.(js|css|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Network-first for HTML navigation (SPA routes)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Default same-origin GET fallback: network first, then runtime cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Listen for messages from the app (e.g. cache car detail pages)
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_CAR") {
    const url = event.data.url;
    if (url) {
      caches.open(RUNTIME_CACHE_NAME).then((cache) =>
        fetch(url)
          .then((r) => {
            if (r.ok) cache.put(url, r);
          })
          .catch(() => {}),
      );
    }
    return;
  }

  if (event.data?.type === "GET_SW_CACHE_VERSION") {
    event.source?.postMessage({
      type: "SW_CACHE_VERSION",
      version: SW_CACHE_VERSION,
      precache: PRECACHE_NAME,
      runtime: RUNTIME_CACHE_NAME,
    });
  }
});

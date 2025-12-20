/* SerCucTech Vetrine PWA – Service Worker */
const CACHE_NAME = "sercuctech-vetrine-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./vetrina.html",
  "./admin.html",
  "./pubblica.html",
  "./stile.css",
  "./app.js",
  "./lang.js",
  "./manifest.webmanifest",
  "./data/index.json"
];

// Install: cache base
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - HTML: network first (per avere aggiornamenti)
// - JSON / media / files: cache first + update in background
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo stesso origin (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // HTML => network first
  if (req.headers.get("accept") && req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Altri asset => cache first, poi update
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

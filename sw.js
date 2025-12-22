// sw.js — SerCucTech (NETWORK FIRST) per evitare “vecchio per sempre”
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Per HTML/JS/CSS: prova sempre rete, se offline usa cache (ma NON blocca gli update)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // solo GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // solo stesso dominio
  if (url.origin !== location.origin) return;

  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const isAsset = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html");

  if (isNav || isAsset) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        return fresh;
      } catch (e) {
        // offline fallback: prova cache del browser
        return caches.match(req) || Response.error();
      }
    })());
  }
});

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("sercuctech-app").then(cache =>
      cache.addAll([
        "./app.html",
        "./admin.html",
        "./vetrina.html",
        "./checklist.html",
        "./manifest.json"
      ])
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

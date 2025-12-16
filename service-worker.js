```javascript
const CACHE_NAME = 'vetrine-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/vetrine.html',
    '/stile.css',
    '/db.js',
    '/script.js',
    '/manifest.json',
    '/icon-192x192.png', 
    '/icon-512x512.png'
];

// Installazione del service worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Attivazione del service worker
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch del service worker
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});
```

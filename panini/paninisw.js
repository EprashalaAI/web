const CACHE_NAME = 'panini-ide-v1';
const LOCAL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './samples.json', // Your examples database
    './icon-192.png',
    './icon-512.png'
];

// Install Event: Cache local files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(LOCAL_ASSETS))
        .then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event: Network-First strategy for CDN, Cache-First for local assets
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response if found (for local files)
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Otherwise, fetch from the network (for Monaco CDN / Wandbox API)
            return fetch(event.request).then((networkResponse) => {
                // Optionally cache Monaco CDN files dynamically here if offline editing is strictly required
                return networkResponse;
            }).catch(() => {
                // Fallback if network fails and asset isn't cached
                console.log("Offline and asset not cached:", event.request.url);
            });
        })
    );
});
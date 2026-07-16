const CACHE_NAME = 'eprashala-library-v3'; // Bumped version to force clear old cache rules
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/in.js',
    '/intry.js',
    '/swar.js',
    '/swara.js',
    '/tools.html',
    '/dhwani.html',
    '/kundli.html',	
    '/appteach1.js', 
    '/panchang.html',
    '/face.html',
    '/tm3.html',
    '/intry3.js',
    '/library_config.json',
    '/manifest.json',
    '/tailwind.js',
    '/html2pdf.bundle.min.js',
    '/marked.min.js', 
    '/finger.html',
    '/palm.html',
    '/pada.html',
    '/sankhya.html',
    '/swara.html',
    '/book.html',
    '/Eye.html',
    '/cv.html',
    '/trip.html' 
];

// Install Event: Pre-cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Pre-caching offline assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up old caches if you update the CACHE_NAME version
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Optimized Stale-While-Revalidate + Dynamic Caching
self.addEventListener('fetch', (event) => {
    // Only handle GET requests (skip POST requests like the Gemini API call)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                
                // 1. Fire a background request to the network to check for updates
                const fetchedResponse = fetch(event.request).then((networkResponse) => {
                    // Check if response is completely valid before updating cache
                    if (networkResponse && networkResponse.status === 200) {
                        // Dynamically updates/caches the file for the next session
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    console.log('[Service Worker] Network request failed. Device is completely offline.');
                });

                // 2. Instant load: Return local cache immediately if it exists.
                // Otherwise, wait for the network response to finish (e.g. first time visiting a dynamic asset).
                return cachedResponse || fetchedResponse;
            });
        })
    );
});
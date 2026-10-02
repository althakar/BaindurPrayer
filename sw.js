const CACHE_NAME = 'baindur-prayer-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/prayer_engine.js',
  '/prayer_data.js',
  '/logo.png',
  '/adhan.mp3',
  '/fajradhan.mp3',
  '/iqaama.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
            return response;
        }
        // Otherwise fetch from network
        return fetch(event.request).catch(() => {
            // Fallback for offline if not in cache (could be extended)
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
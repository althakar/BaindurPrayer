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
        if (response) {
            return response;
        }
        // Return a graceful empty response if the network fails or is blocked by an adblocker
        return fetch(event.request).catch(() => {
            return new Response('Network error or blocked by extension', { 
                status: 408, 
                headers: { 'Content-Type': 'text/plain' } 
            });
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

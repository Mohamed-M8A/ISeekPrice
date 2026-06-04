const CACHE_NAME = 'iseekprice-v4';
const STATIC_ASSETS = [
  '/public/css/style.min.css',
  '/public/fonts/cairo-regular.woff2',
  '/public/fonts/cairo-600.woff2',
  '/public/assets/static/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('.json') || 
      url.pathname.endsWith('.bin') || 
      url.hostname.includes('google-analytics') || 
      url.pathname.includes('/cdn-cgi/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          if (url.pathname.match(/\.(webp|png|jpg|jpeg|woff2|css|js)$/)) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
          }
        }
        return networkResponse;
      }).catch(() => null);
    })
  );
});

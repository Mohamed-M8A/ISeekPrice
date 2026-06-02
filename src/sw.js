const CACHE_NAME = 'iseekprice-v2';
const STATIC_ASSETS = [
  '/public/css/style.min.css',
  '/public/assets/static/favicon.ico',
  '/public/assets/icons/192.png'
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

  if (url.pathname.endsWith('.bin') || 
      url.pathname.endsWith('.json') || 
      url.hostname.includes('google-analytics') ||
      url.pathname.includes('/cdn-cgi/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (url.origin === location.origin && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      
      return cached || networkFetch;
    })
  );
});

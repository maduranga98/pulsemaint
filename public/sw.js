// Bump this version whenever the app shell changes. Changing the name
// forces the `activate` handler below to delete every older cache.
const CACHE_NAME = 'pulsemaint-pm-v2';

// Only pre-cache things that are safe to serve offline. We intentionally do
// NOT pre-cache navigations/HTML here so the newest index.html (and the
// hashed JS/CSS it points at) is always fetched from the network.
const PRECACHE_URLS = [];

// Install: pre-cache shell and take over immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: delete every cache that is not the current version.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests (Firestore, Storage, CDNs, etc.).
  if (url.origin !== self.location.origin) return;

  // Navigations / HTML documents: network-first. This guarantees the user
  // always gets the latest index.html (and therefore the latest bundle),
  // falling back to cache only when offline.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Static hashed assets (JS/CSS/images/fonts): cache-first is safe because
  // Vite fingerprints filenames, so a new build produces new URLs.
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          // Only cache successful, basic (same-origin) responses.
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      );
    })
  );
});

// Production Service Worker for RMCH Student Hub - High-Performance & Cache-Optimized
const CACHE_NAME = 'rmch-hub-v10';

// Immediate self-cleanup if mistakenly loaded on Vite development server
if (self.location.port === '5173' || self.location.port === '5174') {
  self.registration.unregister().catch(() => {});
}

// Core shell assets to precache
const STATIC_ASSETS = [
  './assets/AdminPanel-65UFFZyj.js',
  './assets/Attendance-B1St3y-8.js',
  './assets/BookRenting-DAH3z0cE.js',
  './assets/Home-DdPgtfQD.js',
  './assets/Library-rMqt1an7.js',
  './assets/Profile-CqbcMshT.js',
  './assets/Social-CmfGgytu.js',
  './assets/index-77oFR6Ga.js',
  './assets/index-BNB-Z6hY.css',
  './assets/vendor-icons-6q0fBTfo.js',
  './assets/vendor-motion-NcpTe18u.js',
  './assets/vendor-react-DFmuTK9V.js',
  './assets/vendor-supabase-J7ITh-P0.js',
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './logo.png',
];

// Install: precache app shell safely (does not abort if a single asset fails)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          STATIC_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn(`[SW] Precache skipped for ${asset}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up ALL outdated cache versions to free up browser storage
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Purging old cache:', key);
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Message listener for skipWaiting updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event: high performance caching with zero opaque bloat
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only process GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. NEVER intercept Vite Dev Server files, HMR, or dev tooling (prevents tab freezing and Promise rejection)
  if (
    self.location.port === '5173' ||
    self.location.port === '5174' ||
    url.port === '5173' ||
    url.port === '5174' ||
    url.pathname.includes('/@') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx') ||
    url.search.includes('?t=') ||
    url.search.includes('?import') ||
    url.search.includes('?v=')
  ) {
    return;
  }

  // 3. Only cache SAME-ORIGIN requests (strictly ignore Google Drive, Supabase, external APIs, etc.)
  // This prevents opaque response bloat (each opaque response can cost 7MB of virtual quota!)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 4. Never cache Supabase, auth endpoints, or chrome extensions
  if (url.pathname.includes('/auth/') || url.protocol === 'chrome-extension:') {
    return;
  }

  // 5. HTML Navigation requests: Network-First (always latest online, instant offline fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex =
            (await caches.match('./index.html')) || (await caches.match('./'));
          if (cachedIndex) return cachedIndex;
          return new Response('Offline: RMCH Student Hub is offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 6. Hashed Vite assets (/assets/*): Cache-First (immutable content, no network thrashing)
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Instant return from cache, NO duplicate background fetch!
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response('Asset not found', {
              status: 404,
              statusText: 'Not Found',
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
    );
    return;
  }

  // 7. Other local static assets (manifest, icons, favicon): Safe Cache-First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('Resource offline', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});

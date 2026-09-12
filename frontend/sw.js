// Dominal Technology Jobs - Service Worker
// Network-First, Automatic Updating Cache Strategy (No manual version bumping needed)

const CACHE_NAME = 'dominal-jobs-cache-dynamic';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/sorter.js',
  './js/whatsapp.js',
  './js/sw-register.js',
  './data/jobs.json',
  './manifest.json',
  './icons/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// On install: pre-cache critical shell assets, skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial fail, will cache dynamically:', err);
      });
    })
  );
});

// On activate: take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up any obsolete old cache names if any exist
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Fetch event: Network-First Strategy
// 1. Always attempt fresh network fetch first
// 2. If successful, clone response and update cache silently in the background
// 3. If network fails (offline), fall back to cached version
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Avoid intercepting chrome extensions or cross-origin analytics if any
  if (url.origin !== self.location.origin && !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Check if response is valid
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed, serve from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback for navigation requests (HTML pages)
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        return new Response('Network offline and asset not cached.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// Handle custom message from client (e.g. manual cache clear or trigger notification)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data && event.data.action === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
  // Local native notification trigger from client PWA
  if (event.data && event.data.action === 'showNotification') {
    const title = event.data.title || 'Dominal Technology Jobs';
    const options = {
      body: event.data.body || 'New job listings are available.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: event.data.url || './' }
    };
    self.registration.showNotification(title, options);
  }
});

// Native Notification Click Handler: Focus PWA window or open
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Web Push API Event Handler
self.addEventListener('push', (event) => {
  let data = { title: 'Dominal Technology Jobs', body: 'New jobs scraped and ready to review!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Dominal Technology Jobs', body: event.data.text() };
    }
  }
  const options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});


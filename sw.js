const CACHE = 'doom-web-v1';
const PRECACHE = [
  './',
  './index.html',
  './play.html',
  './css/app.css',
  './js/play.js',
  './js/keys.js',
  './js/gamepad.js',
  './js/touch.js',
  './js/audio.js',
  './js/untar.js',
  './engine/doomgeneric.js',
  './engine/doomgeneric.wasm',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        if (cached) return cached;
        throw new Error('offline');
      }
    })
  );
});

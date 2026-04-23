// SailTrack Service Worker v2
const CACHE = 'sailtrack-v2';

const STATIC = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Install: cache all static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(STATIC.map(url => c.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Map tiles: cache-first with network fallback (tiles stay available offline)
// - API calls (wind): network-first, silent fail offline
// - App shell: cache-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Wind API — network only, don't cache (always live data or nothing)
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Map tiles — cache-first, then network, then offline tile
  if (url.hostname.includes('cartocdn.com') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('openseamap.org')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(e.request);
        if (cached) return cached;
        try {
          const fresh = await fetch(e.request);
          if (fresh.ok) c.put(e.request, fresh.clone());
          return fresh;
        } catch {
          // Return a transparent PNG as placeholder tile
          return new Response(
            atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
            { headers: { 'Content-Type': 'image/png' } }
          );
        }
      })
    );
    return;
  }

  // Everything else: cache-first
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request);
      if (cached) return cached;
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) c.put(e.request, fresh.clone());
        return fresh;
      } catch {
        return new Response('Offline', { status: 503 });
      }
    })
  );
});

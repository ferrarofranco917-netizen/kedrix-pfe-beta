const BW_SW_VERSION = '20260322_cf1';
const BW_CACHE = `kedrix-cache-${BW_SW_VERSION}`;
const BW_CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './runtime-config.js',
  './runtime-i18n.js',
  './session-manager.js',
  './license-guard.js',
  './api-client.js',
  './tracking-hooks.js',
  './license-system.js',
  './app.js',
  './tracking.js',
  './guided-activation.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon-16.png',
  './assets/favicon-32.png',
  './assets/modern-logo-kedrix-pfe.svg'
];

function normalizeUrl(input) {
  const url = new URL(input, self.location.origin);
  url.hash = '';
  url.search = '';
  return url.toString();
}

function isCacheableRequest(request) {
  if (!request || request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && /^https?:$/.test(url.protocol);
}

async function putInCache(cache, request, response) {
  if (!response || !response.ok) return;
  const cacheKey = normalizeUrl(request.url || request);
  await cache.put(cacheKey, response.clone());
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(BW_CACHE);
    await Promise.allSettled(BW_CORE_ASSETS.map(async (asset) => {
      const response = await fetch(asset, { cache: 'no-store' });
      if (response && response.ok) {
        await cache.put(normalizeUrl(asset), response);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('kedrix-cache-') && key !== BW_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  const normalizedRequestUrl = normalizeUrl(request.url);
  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  event.respondWith((async () => {
    const cache = await caches.open(BW_CACHE);

    if (isNavigation) {
      try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        await putInCache(cache, request, networkResponse);
        return networkResponse;
      } catch (_err) {
        const cachedResponse = await cache.match(normalizedRequestUrl)
          || await cache.match(normalizeUrl('./index.html'))
          || await cache.match(normalizeUrl('./'));
        return cachedResponse || Response.error();
      }
    }

    const cachedResponse = await cache.match(normalizedRequestUrl);
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(request, { cache: 'no-store' });
      await putInCache(cache, request, networkResponse);
      return networkResponse;
    } catch (_err) {
      return cachedResponse || Response.error();
    }
  })());
});

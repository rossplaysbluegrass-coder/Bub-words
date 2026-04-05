/**
 * Bub Words Service Worker
 *
 * Strategy:
 *  - Install: pre-cache the app shell (HTML + manifest)
 *  - Runtime caching: network-first for app shell/config, cache-first for media
 *  - Message channel: respond to "CACHE_ASSETS" message from the app to
 *    pre-cache all vocabulary assets and report progress
 *  - Activate: delete stale caches from previous versions
 */

// Increment this whenever you change the service worker or want to invalidate
// older cached shell/config data on installed devices.
const CACHE_VERSION = 'v4';
const SHELL_CACHE = `freeaac-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `freeaac-assets-${CACHE_VERSION}`;

/** App shell: minimal set needed to render the page offline */
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/config/vocabulary.json',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !currentCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests for same-origin or static assets
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation requests: prefer network so installed PWAs pick up new builds.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Config/manifest should refresh from network when online, but still work offline.
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/config/vocabulary.json' || url.pathname === '/manifest.json')
  ) {
    event.respondWith(networkFirstCache(request, SHELL_CACHE));
    return;
  }

  // Media and built assets: cache-first for instant offline usage.
  const cacheToUse =
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/audio/')
      ? ASSET_CACHE
      : SHELL_CACHE;

  event.respondWith(cacheFirst(request, cacheToUse));
});

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/', response.clone());
      return response;
    }

    return response;
  } catch {
    return (await caches.match('/')) || Response.error();
  }
}

async function networkFirstCache(request, cacheName) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (!response || response.status !== 200 || response.type === 'error') {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

// ─── Message: CACHE_ASSETS ───────────────────────────────────────────────────
/**
 * Triggered by the app after it reads vocabulary.json.
 * Payload: { type: 'CACHE_ASSETS', urls: string[] }
 * Responds with progress events via BroadcastChannel.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type !== 'CACHE_ASSETS') return;

  const { urls } = event.data;
  if (!Array.isArray(urls) || urls.length === 0) {
    broadcast({ type: 'CACHE_COMPLETE', cached: 0, total: 0 });
    return;
  }

  event.waitUntil(cacheAssetsWithProgress(urls));
});

async function cacheAssetsWithProgress(urls) {
  const cache = await caches.open(ASSET_CACHE);
  let cached = 0;
  const total = urls.length;

  // Filter out already-cached URLs to avoid redundant network requests
  const uncached = await Promise.all(
    urls.map(async (url) => {
      const hit = await caches.match(url);
      return hit ? null : url;
    })
  );
  const toFetch = uncached.filter(Boolean);

  if (toFetch.length === 0) {
    broadcast({ type: 'CACHE_COMPLETE', cached: 0, total: 0, skipped: total });
    return;
  }

  // Fetch in parallel batches of 6 to avoid saturating the connection
  const BATCH_SIZE = 6;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            cached++;
            broadcast({ type: 'CACHE_PROGRESS', cached: cached + (total - toFetch.length), total });
          }
        } catch {
          // Non-critical: asset will be fetched on demand later
          cached++;
          broadcast({ type: 'CACHE_PROGRESS', cached: cached + (total - toFetch.length), total });
        }
      })
    );
  }

  broadcast({ type: 'CACHE_COMPLETE', cached, total });
}

// ─── BroadcastChannel helper ─────────────────────────────────────────────────

function broadcast(data) {
  const channel = new BroadcastChannel('freeaac-sw');
  channel.postMessage(data);
  channel.close();
}

/**
 * Bub Words Service Worker
 *
 * Strategy:
 *  - Install: pre-cache the app shell (HTML + manifest)
 *  - Runtime caching: cache-first for all app assets (images, audio, JS, CSS)
 *  - Message channel: respond to "CACHE_ASSETS" message from the app to
 *    pre-cache all vocabulary assets and report progress
 *  - Activate: delete stale caches from previous versions
 */

// Increment this whenever you replace existing asset files (images/audio).
// Adding new files doesn't require a bump — only replacing existing ones.
const CACHE_VERSION = 'v3';
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
      .then(() => self.skipWaiting())
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

// ─── Fetch (cache-first) ─────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests for same-origin or static assets
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation requests: return cached shell (SPA support)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) => cached || fetch(request))
    );
    return;
  }

  // All other requests: cache-first, falling back to network → then cache
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Determine which cache to store in
        const cacheToUse =
          url.pathname.startsWith('/images/') ||
          url.pathname.startsWith('/audio/')
            ? ASSET_CACHE
            : SHELL_CACHE;

        caches.open(cacheToUse).then((cache) => {
          cache.put(request, response.clone());
        });

        return response;
      });
    })
  );
});

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

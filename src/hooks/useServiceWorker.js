import { useState, useEffect, useCallback } from 'react';

/**
 * Manages Service Worker registration and orchestrates asset caching.
 *
 * Returns:
 *  - swReady: boolean — SW is active and controlling the page
 *  - cacheProgress: { cached: number, total: number } | null
 *  - cacheComplete: boolean — all assets cached (or no SW support)
 *  - triggerCache: (urls: string[]) => void — call after vocabulary loads
 */
export function useServiceWorker() {
  const [swReady, setSwReady] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(null);
  const [cacheComplete, setCacheComplete] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  // Register the SW and listen for cache progress via BroadcastChannel
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      // No SW support — skip straight to ready state
      setCacheComplete(true);
      return;
    }

    // BroadcastChannel for progress messages from SW
    const channel = new BroadcastChannel('freeaac-sw');
    channel.addEventListener('message', (event) => {
      const { type, cached, total } = event.data ?? {};

      if (type === 'CACHE_PROGRESS') {
        setCacheProgress({ cached, total });
      } else if (type === 'CACHE_COMPLETE') {
        setCacheProgress({ cached: total, total });
        setCacheComplete(true);
      }
    });

    let cleanupRegistration = () => {};
    const onControllerChange = () => {
      setSwReady(true);
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(registration.waiting || installingWorker);
              setUpdateAvailable(true);
            }
          });
        });

        if (registration.active) {
          setSwReady(true);
        } else {
          // Wait for the installing/waiting SW to activate.
          // Use event.target.state — registration.installing is already null
          // by the time 'statechange' fires with state==='activated'.
          const pending = registration.installing || registration.waiting;
          pending?.addEventListener('statechange', function onStateChange(e) {
            if (e.target.state === 'activated') {
              setSwReady(true);
              e.target.removeEventListener('statechange', onStateChange);
            }
          });
        }

        // Also catch SW taking control via clients.claim()
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        const checkForUpdates = () => registration.update().catch(() => {});
        const periodicTimer = window.setInterval(checkForUpdates, 30 * 60 * 1000);
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            checkForUpdates();
          }
        };

        document.addEventListener('visibilitychange', onVisible);

        cleanupRegistration = () => {
          window.clearInterval(periodicTimer);
          document.removeEventListener('visibilitychange', onVisible);
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        };
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
        // Fail gracefully — app still works, just no offline support
        setCacheComplete(true);
      });

    // Safety-net: if the SW never replies (e.g. no assets, blocked by
    // browser policy, or first-boot race), unlock the app after 10 s.
    const fallbackTimer = setTimeout(() => {
      setCacheComplete((prev) => {
        if (!prev) console.warn('[Bub Words] SW cache timeout — showing app anyway');
        return true;
      });
    }, 10_000);

    return () => {
      cleanupRegistration();
      channel.close();
      clearTimeout(fallbackTimer);
    };
  }, []);

  /**
   * Sends asset URLs to the SW for pre-caching.
   * Called once the vocabulary is loaded and we know all asset paths.
   */
  const triggerCache = useCallback((urls) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      setCacheComplete(true);
      return;
    }

    setCacheProgress({ cached: 0, total: urls.length });
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_ASSETS',
      urls,
    });
  }, []);

  const applyUpdate = useCallback(() => {
    setIsApplyingUpdate(true);

    if (!('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }

    const reloadOnce = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
      window.clearTimeout(fallbackReload);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    const fallbackReload = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
      window.location.reload();
    }, 2000);

    const sendSkipWaiting = (worker) => {
      if (!worker) {
        setIsApplyingUpdate(false);
        return;
      }

      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    if (waitingWorker) {
      sendSkipWaiting(waitingWorker);
      return;
    }

    navigator.serviceWorker.getRegistration('/').then((registration) => {
      sendSkipWaiting(registration?.waiting);
    });
  }, [waitingWorker]);

  return {
    swReady,
    cacheProgress,
    cacheComplete,
    triggerCache,
    updateAvailable,
    applyUpdate,
    isApplyingUpdate,
  };
}

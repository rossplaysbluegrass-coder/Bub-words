import { useRef, useCallback, useState } from 'react';

/**
 * Provides instant audio playback for vocabulary items.
 *
 * Strategy:
 *  - Maintains a pool of HTMLAudioElement instances keyed by audio URL
 *  - Each item's <audio> is preloaded on first access
 *  - On play: rewind to start and play immediately (no network fetch)
 *  - Limits concurrent playback to one track at a time (stops previous)
 */
export function useAudio() {
  /** Map<url: string, HTMLAudioElement> */
  const pool = useRef(new Map());
  /** @type {{ current: HTMLAudioElement | null }} */
  const currentRef = useRef(null);
  /** Map<url: string, 'loading' | 'ready' | 'error'> */
  const statusRef = useRef(new Map());
  /** Map<url: string, Promise<void>> */
  const promiseRef = useRef(new Map());
  const batchRef = useRef(0);
  const [audioProgress, setAudioProgress] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [isAudioPreloading, setIsAudioPreloading] = useState(false);

  /**
   * Preloads an audio URL into the pool without playing it.
   * Safe to call multiple times for the same URL.
   */
  const preload = useCallback((url) => {
    if (!url) return Promise.resolve();

    const currentStatus = statusRef.current.get(url);
    if (currentStatus === 'ready' || currentStatus === 'error') {
      return Promise.resolve();
    }

    const existingPromise = promiseRef.current.get(url);
    if (existingPromise) {
      return existingPromise;
    }

    let audio = pool.current.get(url);
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      pool.current.set(url, audio);
    }

    statusRef.current.set(url, 'loading');

    const preloadPromise = new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        audio.removeEventListener('canplaythrough', handleReady);
        audio.removeEventListener('loadeddata', handleReady);
        audio.removeEventListener('error', handleError);
      };

      const finish = (nextStatus) => {
        if (settled) return;
        settled = true;
        cleanup();
        statusRef.current.set(url, nextStatus);
        promiseRef.current.delete(url);
        resolve();
      };

      const handleReady = () => finish('ready');

      const handleError = () => {
        const { code, message } = audio.error ?? {};
        console.error(
          `[Bub Words] Failed to preload audio (code ${code}): ${url}\n` +
            (code === 4
              ? 'File not found, corrupt, or in an unsupported format (e.g. AAC/M4A renamed to .mp3). Re-encode with ffmpeg: ffmpeg -i input -codec:a libmp3lame -qscale:a 2 output.mp3'
              : message)
        );
        finish('error');
      };

      audio.addEventListener('canplaythrough', handleReady, { once: true });
      audio.addEventListener('loadeddata', handleReady, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.load();
    });

    promiseRef.current.set(url, preloadPromise);
    return preloadPromise;
  }, []);

  /**
   * Preloads an array of audio URLs (called after assets are cached by SW).
   */
  const preloadAll = useCallback(
    async (urls) => {
      const uniqueUrls = Array.from(new Set((urls || []).filter(Boolean)));
      const batchId = ++batchRef.current;
      const CONCURRENCY = 6;

      if (!uniqueUrls.length) {
        setAudioProgress({ loaded: 0, total: 0 });
        setAudioReady(true);
        setIsAudioPreloading(false);
        return;
      }

      let completed = 0;
      const pendingUrls = [];

      uniqueUrls.forEach((url) => {
        const status = statusRef.current.get(url);
        if (status === 'ready' || status === 'error') {
          completed += 1;
          return;
        }

        pendingUrls.push(url);
      });

      setAudioReady(completed === uniqueUrls.length);
      setIsAudioPreloading(completed !== uniqueUrls.length);
      setAudioProgress({ loaded: completed, total: uniqueUrls.length });

      if (!pendingUrls.length) {
        return;
      }

      let nextIndex = 0;

      const runWorker = async () => {
        while (nextIndex < pendingUrls.length && batchRef.current === batchId) {
          const url = pendingUrls[nextIndex];
          nextIndex += 1;

          try {
            await preload(url);
          } finally {
            completed += 1;
            if (batchRef.current === batchId) {
              setAudioProgress({ loaded: completed, total: uniqueUrls.length });
            }
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, pendingUrls.length) },
          () => runWorker()
        )
      );

      if (batchRef.current === batchId) {
        setAudioProgress({ loaded: uniqueUrls.length, total: uniqueUrls.length });
        setAudioReady(true);
        setIsAudioPreloading(false);
      }
    },
    [preload]
  );

  /**
   * Plays audio for the given URL.
   * Stops any currently playing audio first to keep focus clear.
   */
  const play = useCallback((url) => {
    if (!url) return;

    // Stop current
    if (currentRef.current && currentRef.current !== pool.current.get(url)) {
      currentRef.current.pause();
      currentRef.current.currentTime = 0;
    }

    let audio = pool.current.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      pool.current.set(url, audio);
    }

    currentRef.current = audio;
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name === 'NotAllowedError') {
          // Autoplay policy — should not happen on a direct user tap.
          console.warn('[Bub Words] Audio blocked by autoplay policy:', url);
          return;
        }
        if (err.name === 'NotSupportedError') {
          // Diagnose whether it's a 404 or a codec problem.
          fetch(url, { method: 'HEAD' })
            .then((res) => {
              if (!res.ok) {
                console.error(
                  `[Bub Words] Audio file not found (HTTP ${res.status}): ${url}\n` +
                  'Check that the file exists at public/audio/<name>.mp3'
                );
              } else {
                console.error(
                  `[Bub Words] Audio file exists but cannot be decoded: ${url}\n` +
                  `Content-Type: ${res.headers.get('content-type')}\n` +
                  'The file may be corrupt, empty, or in an unsupported format.'
                );
              }
            })
            .catch(() => console.error('[Bub Words] Audio file unreachable:', url));
          return;
        }
        console.error('[Bub Words] Audio play failed:', url, err);
      });
    }
  }, []);

  return {
    play,
    preload,
    preloadAll,
    audioProgress,
    audioReady,
    isAudioPreloading,
  };
}

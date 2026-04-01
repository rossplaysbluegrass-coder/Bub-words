import { useRef, useCallback } from 'react';

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

  /**
   * Preloads an audio URL into the pool without playing it.
   * Safe to call multiple times for the same URL.
   */
  const preload = useCallback((url) => {
    if (!url || pool.current.has(url)) return;
    const audio = new Audio();
    audio.preload = 'auto';
    // Log decoding errors at preload time so they surface before the user taps.
    audio.addEventListener('error', () => {
      const { code, message } = audio.error ?? {};
      // code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (bad format or 404)
      // code 2 = MEDIA_ERR_NETWORK
      console.error(
        `[FreeAAC] Failed to preload audio (code ${code}): ${url}\n` +
          (code === 4
            ? 'File not found, corrupt, or in an unsupported format (e.g. AAC/M4A renamed to .mp3). Re-encode with ffmpeg: ffmpeg -i input -codec:a libmp3lame -qscale:a 2 output.mp3'
            : message)
      );
    }, { once: true });
    audio.src = url;
    audio.load();
    pool.current.set(url, audio);
  }, []);

  /**
   * Preloads an array of audio URLs (called after assets are cached by SW).
   */
  const preloadAll = useCallback(
    (urls) => {
      urls.forEach(preload);
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
          console.warn('[FreeAAC] Audio blocked by autoplay policy:', url);
          return;
        }
        if (err.name === 'NotSupportedError') {
          // Diagnose whether it's a 404 or a codec problem.
          fetch(url, { method: 'HEAD' })
            .then((res) => {
              if (!res.ok) {
                console.error(
                  `[FreeAAC] Audio file not found (HTTP ${res.status}): ${url}\n` +
                  'Check that the file exists at public/audio/<name>.mp3'
                );
              } else {
                console.error(
                  `[FreeAAC] Audio file exists but cannot be decoded: ${url}\n` +
                  `Content-Type: ${res.headers.get('content-type')}\n` +
                  'The file may be corrupt, empty, or in an unsupported format.'
                );
              }
            })
            .catch(() => console.error('[FreeAAC] Audio file unreachable:', url));
          return;
        }
        console.error('[FreeAAC] Audio play failed:', url, err);
      });
    }
  }, []);

  return { play, preload, preloadAll };
}

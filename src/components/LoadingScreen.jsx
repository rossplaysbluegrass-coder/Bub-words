import React from 'react';
import '../styles/LoadingScreen.css';

/**
 * Shown on first load while the Service Worker caches all vocabulary assets.
 *
 * Props:
 *  - progress: { cached: number, total: number } | null
 */
export function LoadingScreen({ progress }) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.cached / progress.total) * 100)
      : 0;

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen__content">
        <div className="loading-screen__icon" aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="36" stroke="#4A90D9" strokeWidth="6" />
            <path
              d="M26 40l10 10 18-18"
              stroke="#4A90D9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="loading-screen__title">Bub Words</h1>
        <p className="loading-screen__subtitle">Preparing your app…</p>

        {progress && progress.total > 0 && (
          <div className="loading-screen__progress" aria-label={`Loading ${percent}%`}>
            <div className="loading-screen__progress-track">
              <div
                className="loading-screen__progress-bar"
                style={{ width: `${percent}%` }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="loading-screen__progress-label">
              {progress.cached} / {progress.total}
            </span>
          </div>
        )}

        {(!progress || progress.total === 0) && (
          <div className="loading-screen__spinner" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

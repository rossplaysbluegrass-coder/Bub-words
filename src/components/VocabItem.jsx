import React, { useState, useCallback } from 'react';
import '../styles/VocabItem.css';

/**
 * Single vocabulary tile — image + label, tappable.
 *
 * Props:
 *  - id: string
 *  - label: string
 *  - image: string         — URL to image asset
 *  - audio: string         — URL to audio asset (passed to onSelect)
 *  - onSelect: (id, audio) => void
 *  - variant: 'keyword' | 'grid'   — affects sizing
 */
export function VocabItem({ id, label, image, audio, onSelect, variant = 'grid' }) {
  const [active, setActive] = useState(false);

  const handleActivate = useCallback(() => {
    if (active) return;

    setActive(true);
    onSelect?.(id, audio);

    // Reset highlight after animation
    setTimeout(() => setActive(false), 400);
  }, [active, id, audio, onSelect]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate();
      }
    },
    [handleActivate]
  );

  return (
    <button
      className={`vocab-item vocab-item--${variant}${active ? ' vocab-item--active' : ''}`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      aria-label={label}
      type="button"
    >
      <div className="vocab-item__image-wrap">
        {image ? (
          <img
            src={image}
            alt=""
            className="vocab-item__image"
            draggable={false}
            // Eagerly load since item is visible
            loading="eager"
          />
        ) : (
          <div className="vocab-item__image-placeholder" aria-hidden="true" />
        )}
      </div>
      <span className="vocab-item__label">{label}</span>
    </button>
  );
}

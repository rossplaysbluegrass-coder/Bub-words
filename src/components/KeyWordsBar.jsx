import React from 'react';
import { VocabItem } from './VocabItem.jsx';
import '../styles/KeyWordsBar.css';

/**
 * Always-visible bar pinned at the top showing high-frequency words.
 *
 * Props:
 *  - keyWords: string[]      — list of item IDs
 *  - items: object           — full items map from vocabulary
 *  - onSelect: (id) => void  — callback when an item is tapped
 */
export function KeyWordsBar({ keyWords, items, onSelect }) {
  if (!keyWords?.length) return null;

  return (
    <nav className="keywords-bar" aria-label="Key words">
      <ul className="keywords-bar__list" role="list">
        {keyWords.map((id) => {
          const item = items?.[id];
          if (!item) return null;
          return (
            <li key={id} className="keywords-bar__item">
              <VocabItem
                id={id}
                label={item.label}
                image={item.image}
                audio={item.audio}
                onSelect={onSelect}
                variant="keyword"
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

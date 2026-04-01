import React from 'react';
import { VocabItem } from './VocabItem.jsx';
import '../styles/VocabularyGrid.css';

/**
 * Responsive grid of vocabulary items for the active category.
 *
 * Props:
 *  - category: { id, name, color, accentColor, items: string[] }
 *  - items: object           — full items map from vocabulary
 *  - onSelect: (id, audio) => void
 */
export function VocabularyGrid({ category, items, onSelect }) {
  if (!category) return null;

  return (
    <section
      className="vocab-grid"
      style={{ '--grid-bg': category.color }}
      aria-label={`${category.name} vocabulary`}
    >
      <ul className="vocab-grid__list" role="list">
        {category.items.map((id) => {
          const item = items?.[id];
          if (!item) return null;
          return (
            <li key={id} className="vocab-grid__cell">
              <VocabItem
                id={id}
                label={item.label}
                image={item.image}
                audio={item.audio}
                onSelect={onSelect}
                variant="grid"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

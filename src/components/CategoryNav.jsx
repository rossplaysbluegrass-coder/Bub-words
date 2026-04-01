import React from 'react';
import '../styles/CategoryNav.css';

/**
 * Horizontal scrollable navigation bar for selecting vocabulary categories.
 *
 * Props:
 *  - categories: { id, name, color, accentColor }[]
 *  - activeId: string
 *  - onSelect: (id) => void
 */
export function CategoryNav({ categories, activeId, onSelect }) {
  if (!categories?.length) return null;

  return (
    <nav className="category-nav" aria-label="Vocabulary categories">
      <ul className="category-nav__list" role="list">
        {categories.map((cat) => {
          const isActive = cat.id === activeId;
          return (
            <li key={cat.id} className="category-nav__item">
              <button
                className={`category-nav__btn${isActive ? ' category-nav__btn--active' : ''}`}
                style={{
                  '--cat-color': cat.color,
                  '--cat-accent': cat.accentColor,
                  borderBottomColor: isActive ? cat.accentColor : 'transparent',
                  color: isActive ? cat.accentColor : undefined,
                }}
                onClick={() => onSelect(cat.id)}
                aria-pressed={isActive}
                aria-label={`${cat.name} category`}
              >
                {cat.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

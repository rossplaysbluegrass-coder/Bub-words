import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/CategoryNav.css';

function measureScrollIndicator(node) {
  if (!node || typeof window === 'undefined') {
    return { visible: false, size: '0%', offset: '0%' };
  }

  const isLandscape = window.matchMedia?.('(orientation: landscape)').matches ?? false;
  const clientSize = isLandscape ? node.clientHeight : node.clientWidth;
  const scrollSize = isLandscape ? node.scrollHeight : node.scrollWidth;
  const scrollOffset = isLandscape ? node.scrollTop : node.scrollLeft;

  if (scrollSize <= clientSize + 1 || clientSize <= 0) {
    return { visible: false, size: '0%', offset: '0%' };
  }

  const size = Math.max(16, Math.min(100, (clientSize / scrollSize) * 100));
  const maxScroll = Math.max(1, scrollSize - clientSize);
  const travel = 100 - size;
  const offset = (scrollOffset / maxScroll) * travel;

  return {
    visible: true,
    size: `${size}%`,
    offset: `${offset}%`,
  };
}

/**
 * Horizontal scrollable navigation bar for selecting vocabulary categories.
 *
 * Props:
 *  - categories: { id, name, color, accentColor }[]
 *  - activeId: string
 *  - onSelect: (id) => void
 */
export function CategoryNav({ categories, activeId, onSelect }) {
  const listRef = useRef(null);
  const [indicator, setIndicator] = useState({
    visible: false,
    size: '0%',
    offset: '0%',
  });

  const updateIndicator = useCallback(() => {
    setIndicator(measureScrollIndicator(listRef.current));
  }, []);

  useEffect(() => {
    const listNode = listRef.current;
    if (!listNode) return undefined;

    let frameId = 0;
    const requestUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateIndicator);
    };

    requestUpdate();
    listNode.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    const mediaQuery = window.matchMedia?.('(orientation: landscape)');
    mediaQuery?.addEventListener?.('change', requestUpdate);

    const resizeObserver =
      'ResizeObserver' in window ? new window.ResizeObserver(requestUpdate) : null;
    resizeObserver?.observe(listNode);

    return () => {
      window.cancelAnimationFrame(frameId);
      listNode.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      mediaQuery?.removeEventListener?.('change', requestUpdate);
      resizeObserver?.disconnect();
    };
  }, [categories, updateIndicator]);

  if (!categories?.length) return null;

  return (
    <nav className="category-nav" aria-label="Vocabulary categories">
      <div
        className={`category-nav__scroll-indicator${indicator.visible ? '' : ' category-nav__scroll-indicator--hidden'}`}
        style={{
          '--category-scroll-thumb-size': indicator.size,
          '--category-scroll-thumb-offset': indicator.offset,
        }}
        aria-hidden="true"
      >
        <span className="category-nav__scroll-thumb" />
      </div>

      <ul ref={listRef} className="category-nav__list" role="list">
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

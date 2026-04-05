import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VocabItem } from './VocabItem.jsx';
import '../styles/KeyWordsBar.css';

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
 * Always-visible bar pinned at the top showing high-frequency words.
 *
 * Props:
 *  - keyWords: string[]      — list of item IDs
 *  - items: object           — full items map from vocabulary
 *  - onSelect: (id) => void  — callback when an item is tapped
 */
export function KeyWordsBar({ keyWords, items, onSelect }) {
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
  }, [keyWords, items, updateIndicator]);

  if (!keyWords?.length) return null;

  return (
    <nav className="keywords-bar" aria-label="Key words">
      <div
        className={`keywords-bar__scroll-indicator${indicator.visible ? '' : ' keywords-bar__scroll-indicator--hidden'}`}
        style={{
          '--keywords-scroll-thumb-size': indicator.size,
          '--keywords-scroll-thumb-offset': indicator.offset,
        }}
        aria-hidden="true"
      >
        <span className="keywords-bar__scroll-thumb" />
      </div>

      <ul ref={listRef} className="keywords-bar__list" role="list">
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

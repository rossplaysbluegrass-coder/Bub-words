import React, { useState, useEffect, useCallback } from 'react';
import { useVocabulary } from './hooks/useVocabulary.js';
import { useAudio } from './hooks/useAudio.js';
import { useServiceWorker } from './hooks/useServiceWorker.js';
import { LoadingScreen } from './components/LoadingScreen.jsx';
import { KeyWordsBar } from './components/KeyWordsBar.jsx';
import { CategoryNav } from './components/CategoryNav.jsx';
import { VocabularyGrid } from './components/VocabularyGrid.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';
import './styles/App.css';

/**
 * Main application component.
 *
 * Boot sequence:
 *  1. Fetch vocabulary.json
 *  2. Register Service Worker
 *  3. Once SW is controlling the page, send all asset URLs for pre-caching
 *  4. Preload audio into memory as soon as SW reports cache complete
 *  5. Show LoadingScreen until ready, then reveal the app
 */
export default function App() {
  const { vocabulary, loading: vocabLoading } = useVocabulary();
  const { play, preloadAll } = useAudio();
  const { swReady, cacheProgress, cacheComplete, triggerCache } =
    useServiceWorker();

  const [activeCategoryId, setActiveCategoryId] = useState(null);

  // ── 1. Derive all asset URLs from vocabulary ────────────────────────────────
  const allAssetUrls = React.useMemo(() => {
    if (!vocabulary) return [];
    return Object.values(vocabulary.items).flatMap((item) =>
      [item.image, item.audio].filter(Boolean)
    );
  }, [vocabulary]);

  // ── 2. When SW is ready and vocabulary is loaded, trigger asset caching ─────
  useEffect(() => {
    if (!vocabulary || !swReady || allAssetUrls.length === 0) return;
    triggerCache(allAssetUrls);
  }, [vocabulary, swReady, allAssetUrls, triggerCache]);

  // ── 3. Set the first category as active when vocabulary loads ───────────────
  useEffect(() => {
    if (vocabulary?.categories?.length && !activeCategoryId) {
      setActiveCategoryId(vocabulary.categories[0].id);
    }
  }, [vocabulary, activeCategoryId]);

  // ── 4. Preload audio into memory once all assets are cached ─────────────────
  useEffect(() => {
    if (!cacheComplete || !vocabulary) return;
    const audioUrls = Object.values(vocabulary.items)
      .map((item) => item.audio)
      .filter(Boolean);
    preloadAll(audioUrls);
  }, [cacheComplete, vocabulary, preloadAll]);

  // ── 5. Handle item selection ────────────────────────────────────────────────
  const handleSelect = useCallback(
    (_id, audioUrl) => {
      play(audioUrl);
    },
    [play]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const isReady = !vocabLoading && cacheComplete;

  if (!isReady) {
    return <LoadingScreen progress={cacheProgress} />;
  }

  const activeCategory = vocabulary.categories.find(
    (c) => c.id === activeCategoryId
  );

  return (
    <div className="app">
      {/* Always-visible key words bar */}
      <KeyWordsBar
        keyWords={vocabulary.keyWords}
        items={vocabulary.items}
        onSelect={handleSelect}
      />

      {/* Category navigation */}
      <CategoryNav
        categories={vocabulary.categories}
        activeId={activeCategoryId}
        onSelect={setActiveCategoryId}
      />

      {/* Vocabulary grid for the active category */}
      <main className="app__main">
        <VocabularyGrid
          category={activeCategory}
          items={vocabulary.items}
          onSelect={handleSelect}
        />
      </main>

      {/* Install app button — one-tap, appears only on installable devices */}
      <InstallPrompt />
    </div>
  );
}

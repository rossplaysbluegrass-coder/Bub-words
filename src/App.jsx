import React, { useState, useEffect, useCallback } from 'react';
import { useVocabulary } from './hooks/useVocabulary.js';
import { useAudio } from './hooks/useAudio.js';
import { useServiceWorker } from './hooks/useServiceWorker.js';
import { LoadingScreen } from './components/LoadingScreen.jsx';
import { KeyWordsBar } from './components/KeyWordsBar.jsx';
import { CategoryNav } from './components/CategoryNav.jsx';
import { VocabularyGrid } from './components/VocabularyGrid.jsx';
import { ParentMode } from './components/ParentMode.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';
import { UpdatePrompt } from './components/UpdatePrompt.jsx';
import { applyOverrides, loadOverrides } from './utils/vocabularyOverrides.js';
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
  const {
    swReady,
    cacheProgress,
    cacheComplete,
    triggerCache,
    updateAvailable,
    applyUpdate,
    isApplyingUpdate,
  } =
    useServiceWorker();

  const [overrides, setOverrides] = useState(() => loadOverrides());
  const [isParentModeOpen, setIsParentModeOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const effectiveVocabulary = React.useMemo(() => {
    return applyOverrides(vocabulary, overrides);
  }, [vocabulary, overrides]);

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
    if (!effectiveVocabulary?.categories?.length) {
      setActiveCategoryId(null);
      return;
    }

    if (!activeCategoryId) {
      setActiveCategoryId(effectiveVocabulary.categories[0].id);
      return;
    }

    const stillExists = effectiveVocabulary.categories.some(
      (category) => category.id === activeCategoryId
    );

    if (!stillExists) {
      setActiveCategoryId(effectiveVocabulary.categories[0].id);
    }
  }, [effectiveVocabulary, activeCategoryId]);

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

  const activeCategory = effectiveVocabulary.categories.find(
    (c) => c.id === activeCategoryId
  );

  if (isParentModeOpen) {
    return (
      <ParentMode
        baseConfig={vocabulary}
        initialOverrides={overrides}
        onClose={() => setIsParentModeOpen(false)}
        onApply={setOverrides}
      />
    );
  }

  return (
    <div className="app">
      <button
        type="button"
        className="app__parent-launch"
        onClick={() => setIsParentModeOpen(true)}
        aria-label="Open parent mode"
      >
        <span className="app__parent-launch-icon" aria-hidden="true">⚙</span>
        <span className="app__parent-launch-label">Parent</span>
      </button>

      {/* Always-visible key words bar */}
      <KeyWordsBar
        keyWords={effectiveVocabulary.keyWords}
        items={effectiveVocabulary.items}
        onSelect={handleSelect}
      />

      <div className="app__content">
        {/* Vocabulary grid for the active category */}
        <main className="app__main">
          <VocabularyGrid
            category={activeCategory}
            items={effectiveVocabulary.items}
            onSelect={handleSelect}
          />
        </main>

        {/* Category navigation */}
        <CategoryNav
          categories={effectiveVocabulary.categories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
        />
      </div>

      {/* Install app button — one-tap, appears only on installable devices */}
      <InstallPrompt />

      {/* One-tap update when a new service worker is waiting */}
      <UpdatePrompt show={updateAvailable} onUpdate={applyUpdate} isUpdating={isApplyingUpdate} />
    </div>
  );
}

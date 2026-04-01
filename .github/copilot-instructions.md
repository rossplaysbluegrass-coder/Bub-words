# FreeAAC – Copilot Instructions

## Project Purpose
FreeAAC is a Progressive Web App (PWA) for Augmentative and Alternative Communication (AAC).
It helps non-verbal autistic children communicate using image+audio vocabulary tiles.

## Architecture
- **React 18** + **Vite 6** — fast, minimal build tooling
- **Service Worker** (`public/sw.js`) — cache-first offline strategy, pre-caches all vocabulary assets on first boot
- **BroadcastChannel** (`freeaac-sw`) — SW → app progress reporting during initial cache
- **No heavy dependencies** — only React + ReactDOM

## Key Conventions
- All vocabulary data lives in **`public/config/vocabulary.json`** — no code changes needed to add words
- Audio playback uses an `HTMLAudioElement` pool (`useAudio.js`) — avoids re-fetching, enables instant playback
- Components import their own CSS file from `src/styles/`
- CSS custom properties defined in `src/styles/index.css` (`:root`)
- Minimum tap target: `var(--min-tap)` = 48px (WCAG 2.5.5)

## Adding Vocabulary
1. Add image to `public/images/<id>.svg` (or .jpg/.png/.webp)
2. Add audio to `public/audio/<id>.mp3`
3. Add entry to `public/config/vocabulary.json` under `items`
4. Reference the id in a category's `items` array or `keyWords`

## File Structure
```
public/
  config/vocabulary.json   ← single source of truth for all vocab
  images/                  ← one image per vocabulary item
  audio/                   ← one audio file per vocabulary item
  sw.js                    ← Service Worker
  manifest.json            ← PWA manifest
src/
  hooks/
    useVocabulary.js       ← fetches + provides vocabulary data
    useAudio.js            ← HTMLAudioElement pool, preloadAll, play
    useServiceWorker.js    ← SW registration + cache orchestration
  components/
    LoadingScreen.jsx      ← first-boot progress screen
    KeyWordsBar.jsx        ← always-visible key words
    CategoryNav.jsx        ← category tab bar
    VocabularyGrid.jsx     ← responsive item grid
    VocabItem.jsx          ← single tappable tile
  styles/                  ← one CSS file per component + index.css
  App.jsx                  ← boot sequence orchestrator
```

## Running Locally
```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```
Note: Service Workers only activate over HTTPS or localhost.

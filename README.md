# Bub Words 🗣️

A **production-grade Progressive Web App (PWA)** for Augmentative and Alternative Communication (AAC). Designed for non-verbal and pre-verbal children to communicate using image + audio vocabulary tiles, with instant offline support.

---

## ⚡ Quick Start

### For Development
```bash
git clone <repo-url>
cd FreeAAC
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

### For Production (Local Testing)
```bash
npm run build
npm run preview
```
Open the URL shown (usually **http://localhost:4173**).

---

## 📱 Installation as a PWA

Once deployed to HTTPS (e.g., Render, Netlify, Vercel):

**Android:**
1. Open the app in Chrome
2. Tap menu (⋮) → **Install app** or **Add to Home screen**
3. Tap **Install**

**iPhone/iPad:**
1. Open the app in Safari
2. Tap Share → **Add to Home Screen**
3. Tap **Add**

**Offline Use:**
- Open the app once while online
- Close the browser / app
- Enable Airplane Mode
- Relaunch the app — all images and audio work offline

---

## 📝 Adding Vocabulary

All vocabulary is controlled by **one JSON file**: [`public/config/vocabulary.json`](public/config/vocabulary.json). No code changes needed.

### Step 1: Add an Image
Place an image at:
```
public/images/<item-id>.svg
```
or `.jpg`, `.png`, `.webp` (SVG recommended for crisp quality on all devices)

### Step 2: Add Audio
Place an audio file at:
```
public/audio/<item-id>.mp3
```

**Audio Format Requirements:**
- Must be a **valid MP3** (not AAC/M4A renamed to `.mp3`)
- 44.1 kHz mono or stereo, 96–192 kbps
- If you have an AAC file, convert it:
  ```bash
  ffmpeg -i input.m4a -codec:a libmp3lame -qscale:a 2 output.mp3
  ```

### Step 3: Update the Config
Edit [`public/config/vocabulary.json`](public/config/vocabulary.json):

```json
{
  "keyWords": ["more", "help", "stop", ...],
  
  "categories": [
    {
      "id": "food",
      "name": "🍽️ Food",
      "color": "#E8F5E9",
      "accentColor": "#388E3C",
      "items": ["apple", "banana", "new-item"]
    }
  ],
  
  "items": {
    "new-item": {
      "label": "New Item",
      "image": "/images/new-item.svg",
      "audio": "/audio/new-item.mp3"
    }
  }
}
```

### Step 4: Update Service Worker Cache Version
When you **replace** existing audio or image files, increment the cache version in [`public/sw.js`](public/sw.js):

```javascript
const CACHE_VERSION = 'v3';  // was 'v2'
```

This forces the Service Worker to discard old cached files and fetch fresh ones. (Adding new files doesn't require a bump.)

### Step 5: Deploy
```bash
npm run build
git push
```
If using Render: the build will automatically trigger and deploy.

---

## 🚀 Deployment

### Render (Recommended for PWA)

1. **Connect your GitHub repo** to Render
2. **Create a Static Site** (not Web Service)
3. **Build Command:** `npm install && npm run build`
4. **Publish Directory:** `dist`
5. **Deploy**

Render automatically provides HTTPS (required for PWA install prompt on mobile).

### Netlify / Vercel

Both work equally well:
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- HTTPS: automatic

---

## 🎨 Customization

### Branding
- **App Name:** Update `public/manifest.json` → `"name"`
- **App Icon:** Add 192×192 and 512×512 PNG files to `public/icons/` and register in `manifest.json`
- **Colors:** Edit `src/styles/index.css` → `:root` CSS variables

### Categories & Emojis
Edit the `"name"` field in [`public/config/vocabulary.json`](public/config/vocabulary.json):
```json
"name": "🍽️ Food"
```
Categories auto-update on next page load.

### Keyboard Shortcuts & Navigation
The app is fully keyboard-accessible:
- **Tab** through items
- **Enter** / **Space** to select
- **Arrow keys** in category nav (if needed — implement via `CategoryNav.jsx`)

---

## 🔧 Architecture

```
public/
  config/vocabulary.json     ← single source of truth for all vocab
  audio/                     ← one .mp3 per item
  images/                    ← one SVG/PNG per item
  sw.js                      ← Service Worker (offline caching)
  manifest.json              ← PWA manifest

src/
  hooks/
    useVocabulary.js         ← fetches config
    useAudio.js              ← audio playback + memory preload
    useServiceWorker.js      ← SW registration & cache orchestration
  
  components/
    VocabItem.jsx            ← tappable tile
    VocabularyGrid.jsx       ← category grid
    KeyWordsBar.jsx          ← always-visible top bar
    CategoryNav.jsx          ← category tabs
    LoadingScreen.jsx        ← first-boot progress UI
  
  styles/                    ← one CSS file per component
  App.jsx                    ← boot sequence orchestrator
```

---

## 📊 Offline-First Strategy

1. **First Load:** App shows progress bar while Service Worker pre-caches all images and audio
2. **Memory Preload:** Audio is loaded into `HTMLAudioElement` pool — **instant playback on tap** (zero network fetch)
3. **Subsequent Loads:** Every request hits the Service Worker cache first
4. **No Internet?** App works perfectly offline (already cached)
5. **Update Assets:** Bump `CACHE_VERSION` to invalidate old caches

---

## 🐛 Troubleshooting

### Audio doesn't play
1. **Check DevTools Console** (F12)
2. **Look for `[Bub Words]` error messages** — they diagnose the exact issue
3. **Common causes:**
   - File is AAC/M4A renamed to `.mp3` → re-encode with ffmpeg
   - File not found → verify path matches config exactly
   - Service Worker cached old file → clear DevTools Storage or bump `CACHE_VERSION`

### Image not showing
- Verify path is correct: `public/images/<id>.svg`
- Ensure file extension matches in config (case-sensitive on Linux/Mac)
- Check DevTools Network tab for failed requests

### PWA won't install on mobile
- Ensure site is served over **HTTPS** (localhost works for dev)
- Validate manifest: DevTools → Application → Manifest
- Check Lighthouse PWA score (should be >90)

### Service Worker not updating
- Bump `CACHE_VERSION` in [`public/sw.js`](public/sw.js)
- Wait 30 seconds, hard-refresh (**Ctrl+Shift+R** or **Cmd+Shift+R**)

---

## ✅ Checklist for New Deployments

- [ ] All audio files are valid MP3 (test locally with `npm run dev`)
- [ ] All image files exist in `public/images/`
- [ ] Config JSON is valid (no trailing commas)
- [ ] Service Worker cache version bumped (if replacing files)
- [ ] Tested on mobile/tablet (portrait and landscape)
- [ ] Offline test: went online, closed app, Airplane Mode, reopened
- [ ] Lighthouse PWA score ≥ 90
- [ ] Deploy!

---

## 📄 License

Production-grade AAC PWA. Free for nonprofits and educational use.

---

## 🤝 Contributing

Found a bug? Want to add a feature?
1. Fork the repo
2. Create a feature branch
3. Submit a pull request

---

**Made with ❤️ for children who deserve to be heard.**

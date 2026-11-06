# momo

**Buddy** — a small desktop AI companion that floats on your screen, talks, and remembers you.

> `momo` is the project name; the character is called **Buddy**. Rename either freely — the persona name lives in one or two places (see “Renaming”).

---

## Quick start

```bash
npm install
npm run dev      # Electron + Vite with hot reload
```

Other scripts:

```bash
npm run build      # production build → out/
npm start          # preview the production build
npm run typecheck  # tsc --noEmit
```

On first run a pink blob spirit appears near the bottom-right of your screen. Drag it anywhere — the position is remembered. Click it to open the panel.

---

## What works today

| Area | Status |
|---|---|
| Transparent, frameless, always-on-top window | ✅ |
| Drag to move, position persists between launches | ✅ |
| PixiJS character with 8 states (idle, listening, thinking, talking, happy, sad, surprised, sleepy) | ✅ |
| Breathing, blinking, eye-tracking, mood color shifts | ✅ |
| Click character → glass panel (Chat / Memory / Settings) | ✅ |
| Dark/light theme | ✅ |
| System tray (show/hide, panel, mute, quit) | ✅ |
| Global push-to-talk hotkey (default `Ctrl+Space`) | ✅ |
| Local memory (name, notes, mood, preferences) | ✅ |
| Local desktop skills: time, date, open site/app, clipboard read, notes, timer | ✅ |
| Anthropic Claude brain | ⛔ next milestone |
| Wake word ("Hey momo") | ⛔ next milestone |
| Speech-to-text | ⚠️ see limitations |
| Screen awareness | ⛔ not built |

### Try it

1. Click Buddy → **Chat** → type `what time is it` → it replies with the real time.
2. Say/type `take a note: buy milk` → check the **Memory** tab.
3. Press `Ctrl+Space` to toggle push-to-talk.
4. Tray icon → show/hide/quit.

---

## Project structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # windows, tray, hotkey, IPC, persistence
│   └── skills.ts         # local desktop skills (add new ones here)
├── preload/
│   └── index.ts          # contextBridge API exposed as window.buddy
└── renderer/             # React UI (two views in one bundle)
    ├── index.html
    ├── main.tsx          # routes ?view=buddy | ?view=panel
    ├── buddy/Buddy.tsx   # the floating character window
    ├── panel/Panel.tsx   # chat / memory / settings panel
    ├── components/
    │   ├── CharacterCanvas.tsx  # PixiJS vector character + animation
    │   └── SpeechBubble.tsx     # glass speech bubble
    ├── hooks/
    │   ├── useSpeech.ts  # STT/TTS abstraction (swap providers here)
    │   └── useMemory.ts  # memory load/save via IPC
    └── services/
        └── brain.ts      # conversation layer (Claude goes here)
electron.vite.config.ts
```

Two windows, one renderer bundle: the buddy window is 280×320 and transparent; the panel is a separate 400×540 frameless window opened on click.

---

## How it was built

- **Electron + TypeScript + React**, bundled by **electron-vite** (Vite for the renderer, esbuild for main/preload).
- **PixiJS** draws the character entirely with vector `Graphics` — no sprite sheets. This keeps it crisp at any DPI, lets mood colors blend smoothly, and costs almost nothing while idle.
- **CSP-safe**: the renderer forbids `eval`; `@pixi/unsafe-eval` provides Pixi's non-eval shader path.
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, and a single small `window.buddy` bridge. The API key is encrypted with Electron `safeStorage`.

---

## API key

The Claude brain is not wired up yet. When it is, the key will be stored via `safeStorage` and read only in the main process.

To prepare one now:

1. Create a key at <https://console.anthropic.com/>.
2. Open Buddy's panel → **Settings** → paste it into **Anthropic API key** → **Save key**.

It is written encrypted to the app's `userData` folder and is never placed in source or sent to the renderer after saving.

---

## Known limitations (being honest)

- **Speech-to-text does not work in Electron yet.** The Web Speech API in Electron reports `network` errors because Chromium has no Google speech backend. The UI detects this and tells you to type instead. Fixing it means adding a Whisper-based provider behind `useSpeech` (local `whisper.cpp` or an API).
- **Wake word is not active.** Only push-to-talk is wired.
- **No Claude yet.** `src/renderer/services/brain.ts` is a small local stub covering greetings and skills.
- **macOS/Linux** are untested; window/tray code is cross-platform but only Windows has been verified.
- **Tray icon** is generated at runtime (no binary asset).

---

## Privacy

- The microphone is only activated by explicit action (hotkey or panel button).
- Memory is stored locally in `%APPDATA%/momo/memory.json` (or the platform equivalent) and can be fully deleted from the Memory tab.
- Window position and settings stay in the same local folder.
- No analytics, no network calls yet (the only future one will be the Claude API).

---

## Roadmap

- [x] Transparent window + animated character
- [x] Draggable + position persistence
- [x] Panel, themes, tray, hotkey
- [x] Local memory + local skills
- [ ] Streaming Claude conversation (main process, SSE)
- [ ] Whisper STT provider + wake word
- [ ] Voice-synced mouth amplitude
- [ ] Screen awareness (opt-in, visible indicator)
- [ ] Proactive moments (break reminder, good morning)
- [ ] Packaging (electron-builder) for Windows/macOS/Linux

---

## Renaming

Search for `momo` and `Buddy` in `src/`. The persona name appears in the main-process strings (`src/main/index.ts`), `Buddy.tsx` greetings, and `README.md`. The product name is in `package.json`.

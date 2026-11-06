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
| Speech-to-text | ✅ push-to-talk, local Whisper + instant Windows fallback |
| Voice commands (time, open app/site, notes, clipboard, timer) | ✅ |
| Screen awareness | ⛔ not built |

### Try it

1. Click Buddy → **Chat** → type `what time is it` → it replies with the real time.
2. Press `Ctrl+Space` to start listening, say **“open notepad”**, **“what time is it”**, **“take a note buy milk”**, **“set a timer for 2 minutes”**, or **“read my clipboard”**, then press `Ctrl+Space` again to send.
3. Check the **Memory** tab to see notes.
4. Tray icon → show/hide/quit.

---

## Voice

Push-to-talk is the voice loop today (press once to start, again to send):

1. Press `Ctrl+Space` (or the mic button in the panel).
2. Buddy records raw 16 kHz mono audio in the renderer.
3. Audio is sent once to the main process and transcribed **locally** — nothing is uploaded.
4. The transcript goes through `src/renderer/services/brain.ts`, which maps commands to desktop skills and replies through the OS voice.

Two engines sit behind the same interface in `src/main/stt/`:

- **Whisper** (`Xenova/whisper-tiny.en`, quantized) via transformers.js + ONNX Runtime. It is the accuracy path and runs fully offline once installed.
- **Windows desktop recognizer** (`System.Speech`). Zero download, available instantly, used as the first-run fallback and whenever Whisper is unavailable. On non-Windows platforms Whisper is the only engine.

The first voice command can use the Windows engine immediately while the ~41 MB Whisper model downloads in the background (resumable, into `userData/models`, no status spam). Later commands automatically use Whisper.

- Audio is captured with `getUserMedia` only while recording; the mic track is stopped immediately on send.
- The UI only depends on `{ ok, text }` from `src/main/stt/index.ts`, so another provider can be dropped in without touching React.

---

## Project structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # windows, tray, hotkey, IPC, persistence
│   ├── skills.ts         # local desktop skills (add new ones here)
│   └── stt/              # speech-to-text providers
│       ├── index.ts      # engine choice + fallback
│       ├── whisper.ts    # local Whisper download/inference
│       ├── windows.ts    # System.Speech fallback (Windows)
│       └── wav.ts        # Float32 → 16-bit PCM WAV
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
    │   ├── useVoice.ts   # push-to-talk: record → transcribe → callback
    │   ├── useTTS.ts     # text-to-speech (swap provider here)
    │   └── useMemory.ts  # memory load/save via IPC
    ├── lib/
    │   └── recorder.ts   # 16 kHz mono PCM capture
    └── services/
        └── brain.ts      # command parsing / conversation layer
electron.vite.config.ts
```

Two windows, one renderer bundle: the buddy window is 280×320 and transparent; the panel is a separate 400×540 frameless window opened on click.

---

## How it was built

- **Electron + TypeScript + React**, bundled by **electron-vite** (Vite for the renderer, esbuild for main/preload).
- **PixiJS** draws the character entirely with vector `Graphics` — no sprite sheets. This keeps it crisp at any DPI, lets mood colors blend smoothly, and costs almost nothing while idle.
- **Whisper via transformers.js + ONNX Runtime** runs in the main process, so speech recognition is local and the renderer stays sandboxed. A zero-download Windows recognizer covers the first run and slow networks.
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

- **Wake word is not active.** Voice is push-to-talk only (`Ctrl+Space`); a wake word needs continuous listening + keyphrase detection.
- **The Whisper model is English-only** (`whisper-tiny.en`). Other languages need a multilingual model.
- **First Whisper use needs internet** to fetch ~41 MB. On Windows the OS recognizer works immediately without it; on macOS/Linux the first command waits for the download.
- **Tiny is fast, not perfect.** Expect ~2–4 s per short phrase on CPU and occasional mishearings; swap `WHISPER_MODEL` in `src/main/stt/whisper.ts` for a larger model if accuracy matters more than speed.
- **No Claude yet.** `src/renderer/services/brain.ts` is a local command parser.
- **macOS/Linux** are untested; they use Whisper only, since the fallback is Windows-specific.
- **Tray icon** is generated at runtime (no binary asset).

---

## Privacy

- The microphone is only activated by explicit action (hotkey or panel button), and the track is stopped the moment recording ends.
- Audio is transcribed locally with Whisper; recordings are never written to disk or uploaded.
- Memory is stored locally in `%APPDATA%/momo/memory.json` (or the platform equivalent) and can be fully deleted from the Memory tab.
- Window position and settings stay in the same local folder.
- No analytics. The only network access is the one-time speech-model download (and, later, the Claude API).

---

## Roadmap

- [x] Transparent window + animated character
- [x] Draggable + position persistence
- [x] Panel, themes, tray, hotkey
- [x] Local memory + local skills
- [x] Push-to-talk voice commands with local Whisper
- [ ] Streaming Claude conversation (main process, SSE)
- [ ] Wake word detection
- [ ] Voice-synced mouth amplitude from real TTS output
- [ ] Screen awareness (opt-in, visible indicator)
- [ ] Proactive moments (break reminder, good morning)
- [ ] Packaging (electron-builder) for Windows/macOS/Linux

---

## Renaming

Search for `momo` and `Buddy` in `src/`. The persona name appears in the main-process strings (`src/main/index.ts`), `Buddy.tsx` greetings, and `README.md`. The product name is in `package.json`.

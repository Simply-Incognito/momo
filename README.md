# momo

**Buddy** — a cute, interactive AI character that lives on your desktop, talks to you by voice, and remembers you.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get an Anthropic API key:**
   - Sign up at: https://console.anthropic.com/
   - Get your API key from the console
   - Add it via: `npm run setup-api` or through the settings panel

3. **Run Buddy:**
   ```bash
   npm run dev
   ```

## Features

### Core Experience
- **Floating character**: A cute blob spirit that lives in a transparent, frameless window always on top
- **Voice conversation**: Wake word ("Hey Buddy") or push-to-talk (Ctrl+Space) to talk
- **Memory**: Remembers your name, preferences, and mood across sessions
- **Animation**: Smooth 60fps animations with spring physics

### Character States
- **Idle**: Breathing, blinking, looking around, occasional wander
- **Listening**: Perks up, eyes widen, subtle glow
- **Thinking**: Gentle swirl animation
- **Talking**: Mouth synced to audio amplitude
- **Happy, Sad, Surprised, Sleepy**: Distinct expressions

### Skills (coming in milestones)
- Open apps and websites
- Set timers and reminders
- Tell time/weather
- Read clipboard aloud
- Screen awareness (opt-in)

### UI
- Glassmorphism speech bubbles
- Dark/light themes with accent color customization
- System tray icon with show/hide, mute, settings, quit
- Settings panel for voice, personality, and character customization

## Project Structure

```
momo/
├── electron/           # Electron main process
│   ├── main.ts         # Main window, tray, IPC handlers
│   └── preload.js      # Bridge between renderer and Electron APIs
├── src/
│   ├── renderer/
│   │   ├── index.html  # HTML entry point
│   │   ├── main.tsx    # React root + reduced motion handling
│   │   ├── components/
│   │   │   ├── App.tsx      # Main application component
│   │   │   ├── CharacterCanvas.tsx  # PixiJS character animation
│   │   │   └── SpeechBubble.tsx     # Glassmorphism speech bubble
│   │   ├── hooks/
│   │   │   ├── useMemory.ts   # IndexedDB/localStorage persistence
│   │   │   └── useSpeech.ts   # Web Speech API abstraction
│   │   └── styles/
│   │       └── main.css       # Glassmorphism and animation styles
│   └── services/
│       └── AnimationService.ts # Character state management
├── package.json          # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Technology Stack

- **Electron** v30 - Desktop shell with transparent, frameless windows
- **React** v19 + TypeScript - UI framework
- **PixiJS** - 60fps canvas/WebGL animation for the character
- **Web Speech API** - Speech recognition (with abstraction for Whisper later)
- **SpeechSynthesis API** - Text-to-speech (with abstraction for ElevenLabs later)
- **Anthropic Claude API** - LLM brain with streaming responses
- **IndexedDB/localStorage** - Local memory persistence

## Milestones

### Milestone 1: Transparent Window + Animated Character ✓
- Frameless, always-on-top, transparent window
- Cute blob character with expressive animations
- Drag to position, position remembered between launches

### Milestone 2: Voice Loop
- Wake word detection ("Hey Buddy")
- Push-to-talk via Ctrl+Space (configurable)
- Text-to-speech responses
- Character animates through states (idle ↔ listening ↔ thinking ↔ talking)

### Milestone 3: Memory + Personality
- Persistent memory of name, preferences, mood patterns
- Character references memory naturally in conversation
- Personality sliders (playful/serious, talkative/quiet)

### Milestone 4: Skills
- Open apps and websites
- Set timers and reminders
- Time/weather queries
- Clipboard reading
- Screen awareness (opt-in with indicator)

### Milestone 5: Polish
- System tray integration
- Full settings panel
- Theme customization
- Break reminders and proactive moments
- Easy off/on toggles for all proactive features

## Getting an API Key

1. Sign up at https://console.anthropic.com/
2. Generate an API key
3. Add it through the settings panel in the app, or run:
   ```bash
   npm run setup-api
   ```
   (This will create a config file with your key stored securely)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
# (Electron will package the app)
```

## Privacy & Security

- **Audio processing**: Only begins after wake word or hotkey press
- **Memory**: Stored locally in user data directory
- **API key**: Stored in encrypted local storage, never hardcoded
- **Screen awareness**: Opt-in only, with visible indicator when active
- **Delete memory**: Use the "View Full Memory" button in settings to clear all stored data

## Character Design

The default character is **"Puff"** - a cute blob spirit creature with:
- Big expressive eyes that change shape based on emotion
- Soft pastel pink color scheme
- Breathing rhythm when idle
- Wanders slightly when you're active
- Reacts to cursor position
- Mood-based color shifts (listening, thinking, talking, etc.)

Other concepts considered:
- **Spark**: A tiny electric sprite with glowing antennae
- **Nimbus**: A gentle cloud creature with rosy cheeks

## License

MIT - feel free to modify and extend!
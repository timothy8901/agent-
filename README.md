# Desktop Pet Patti

A tiny pet that lives in the corner of your Mac, runs entirely on-device, and can actually help with things — your calendar, reminders, finding files, and reacting to what's on your screen.

> macOS only. Everything (the LLM, the vision model, your chat history) stays on your laptop.

---

## Install

1. Download **Desktop Pet Patti.dmg** from the [Releases page](https://github.com/timothy8901/agent-/releases).
2. Open the `.dmg` and drag **Desktop Pet Patti** to **Applications**.
3. Double-click it. macOS will say it's from an unidentified developer — open **System Settings → Privacy & Security → Open Anyway**.
4. On first launch, Patti's welcome wizard will:
   - Install Ollama for you (~200 MB)
   - Download the chat model `qwen3:4b` (~2.5 GB)
   - Download the vision model `moondream` (~1.7 GB)
   That's it. Click "Set me up" and walk away — it takes 5–10 minutes on a decent connection.

You'll be asked for three macOS permissions over time:

- **Screen Recording** — so Patti can react to what you're working on
- **Calendar** — so Patti can read and add events
- **Notifications** — so reminders actually fire

---

## What Patti does

| | |
|---|---|
| 💬 **Chat** | Streamed local LLM. Click Patti to open the chat bubble. |
| 👁 **Vision** | Patti glances at your screen every minute and reacts — "scoot over!" for video, quiet mode for code, hype mode for games. |
| 📅 **Calendar** | "What's on my schedule this week?" / "Add a dentist appointment Thursday at 3pm." |
| ⏰ **Reminders** | "Remind me to stretch in 25 minutes." Fires a real macOS notification. |
| 🔎 **File finder** | "Find the PDF about taxes I downloaded last week." Searches via Spotlight. |
| 🎮 **Games** | Rock-Paper-Scissors, Catch, Space Invaders. |
| 🎨 **Customization** | Colors, faces, ears, name. Click ✏️ to rename her. |
| 🎙 **Voice** | Hold the mic to dictate. Toggle 🔊 to have her speak replies. |

---

## Build from source

```bash
git clone https://github.com/timothy8901/agent-.git desktop-pet-patti
cd desktop-pet-patti
npm install

# Run in dev (live reload)
npm run dev

# Produce a .dmg
npm run package
# → dist/Desktop Pet Patti-3.0.0-arm64.dmg
```

Or just double-click `INSTALL.command` in Finder — it does the same thing.

---

## Architecture

```
src/
├── main/
│   ├── index.ts            Electron main — overlay window, IPC, screen capture
│   ├── installOllama.ts    First-run Ollama installer (DMG → /Applications)
│   ├── toolRouter.ts       Dispatches LLM tool calls to the modules below
│   └── tools/
│       ├── calendar.ts     macOS Calendar via osascript
│       ├── alarms.ts       Persisted reminders + Electron notifications
│       └── fileFinder.ts   Spotlight (mdfind) search of $HOME
├── preload/
│   └── index.ts            contextBridge: drag, screen capture, tools, install
├── shared/
│   ├── tools.ts            Tool catalog (Ollama function-calling schema)
│   └── installTypes.ts     Install progress types shared by main + renderer
└── renderer/src/
    ├── App.tsx                Pet, toolbar, panels, first-run wizard wiring
    ├── components/
    │   ├── PetCanvas.tsx      Procedural canvas animations
    │   ├── ChatBubble.tsx     Streaming chat + inline tool-call status
    │   ├── WelcomePanel.tsx   First-run wizard (install Ollama + pull models)
    │   ├── AlarmsPanel.tsx    Pending reminders list
    │   ├── ScreenPanel.tsx    Vision setup + status
    │   ├── CustomizationPanel.tsx
    │   ├── GamesPanel.tsx + games/{RockPaperScissors,CatchGame,SpaceInvaders}.tsx
    │   └── SettingsPanel.tsx
    ├── hooks/
    │   ├── useOllama.ts        Streaming chat + tool-calling loop
    │   ├── useScreenContext.ts Screen capture → moondream → classify
    │   ├── useVoice.ts         Web Speech API (mic + TTS)
    │   └── usePetAppearance.ts Color/face/ear/name state
    └── lib/
        └── ollamaPull.ts       Shared streaming model pull
```

---

## Privacy

- The LLM (`qwen3:4b`) and vision model (`moondream`) run locally via Ollama.
- Patti never makes outbound network calls except: (a) the first-time download of Ollama and models, (b) the Ollama daemon at `localhost:11434`.
- Chat history, reminders, and your pet's customization are stored in `~/Library/Application Support/Desktop Pet Patti/` as plain JSON.

---

## License

MIT.

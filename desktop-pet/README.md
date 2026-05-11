# 🐾 Desktop Pet — Clippy-style LLM companion

An always-on-top transparent overlay desktop pet that lives in the corner of your screen and acts as a shell for a local Qwen LLM via Ollama.

---

## What it is

- **Animated pet** drawn in Canvas — bobs, blinks, waves, sparkles, shows typing dots while the LLM thinks
- **Transparent overlay** — click-through on empty areas, only the pet and chat are interactive (true Clippy-style)
- **Streaming chat** — responses stream in real-time from Ollama running locally
- **Persistent history** — conversation saved to localStorage between sessions
- **Draggable** — click-drag the pet to any corner of your screen
- **Dark glass UI** — sleek dark chat bubble with markdown + code block rendering

---

## Quick start

### 1. Install Ollama + pull Qwen

```bash
# Install Ollama: https://ollama.com
brew install ollama          # macOS
# or: https://ollama.com/download for Windows/Linux

# Pull a Qwen model (pick one):
ollama pull qwen2.5:3b       # fast, ~2 GB  (recommended to start)
ollama pull qwen2.5:7b       # balanced, ~4.5 GB
ollama pull qwen2.5:14b      # best quality, ~9 GB

# Start Ollama (it auto-starts as a service on most installs)
ollama serve
```

### 2. Run the desktop pet

```bash
# Clone repo
git clone https://github.com/timothy8901/agent-
cd agent-/desktop-pet

# Install deps
npm install

# Dev mode (shows DevTools on first run)
npm run dev

# Or build a distributable app:
npm run package
# -> dist/Desktop Pet-1.0.0.dmg  (macOS)
# -> dist/Desktop Pet Setup 1.0.0.exe  (Windows)
# -> dist/Desktop Pet-1.0.0.AppImage  (Linux)
```

---

## Usage

| Action | What it does |
|--------|-------------|
| **Left-click** pet | Open / close chat |
| **Click-drag** pet | Move it to any corner |
| **Right-click** pet | Context menu (links, quit) |
| **Enter** in chat | Send message |
| **Shift+Enter** | Newline in input |
| **⚙ Settings** button | Change model, URL, system prompt |
| **🗑 Clear** button | Wipe chat history |
| **■ Stop** button | Interrupt streaming response |

---

## Configuration

Click **⚙** inside the chat bubble:

| Setting | Default | Notes |
|---------|---------|-------|
| Ollama URL | `http://localhost:11434` | Change if Ollama runs on a remote machine |
| Model | `qwen2.5:3b` | Any model installed in Ollama works |
| System prompt | Igachi persona | Customize the pet's personality |

The app auto-detects installed models from Ollama and shows them as clickable chips.

---

## Architecture

```
src/
├── main/
│   └── index.ts         Electron main — transparent window, IPC handlers, drag, click-through
├── preload/
│   └── index.ts         contextBridge API surface (setIgnoreMouseEvents, drag, expand)
└── renderer/src/
    ├── App.tsx           Root: pet state, chat toggle, drag logic, click-through detection
    ├── components/
    │   ├── PetCanvas.tsx Canvas-drawn animated creature (RAF loop, 7 animation states)
    │   ├── ChatBubble.tsx Streaming chat UI with inline markdown renderer
    │   └── SettingsPanel.tsx Model/prompt configuration
    ├── hooks/
    │   └── useOllama.ts  Streaming fetch → Ollama /api/chat, history persistence
    └── globals.css       Dark glass UI, transparent root, all component styles
```

---

## Tech stack

- **Electron 29** — transparent frameless always-on-top window
- **React 18 + TypeScript** — UI
- **Vite + electron-vite** — fast dev + build
- **Canvas API** — pet animations (no sprite sheets, all procedural)
- **Ollama REST API** — streaming NDJSON responses from any local model
- **localStorage** — chat history + settings persistence

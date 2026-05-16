import { useEffect, useRef, useState, KeyboardEvent, ChangeEvent } from 'react'
import type { Message, OllamaSettings } from '../hooks/useOllama'

interface Props {
  messages:       Message[]
  streaming:      boolean
  ollamaOnline:   boolean | null
  activeTool:     string | null
  onSend:         (text: string) => void
  onStop:         () => void
  onClose:        () => void
  onClearHistory: () => void
  onOpenSettings: () => void
  settings:       OllamaSettings
  // Voice
  listening:      boolean
  speaking:       boolean
  voiceSupported: boolean
  ttsEnabled:     boolean
  onMicDown:      () => void
  onMicUp:        () => void
  onToggleTts:    () => void
}

export default function ChatBubble({
  messages, streaming, ollamaOnline, activeTool,
  onSend, onStop, onClose, onClearHistory, onOpenSettings, settings,
  listening, speaking, voiceSupported, ttsEnabled, onMicDown, onMicUp, onToggleTts,
}: Props) {
  const [input,   setInput]   = useState('')
  const [fileCtx, setFileCtx] = useState<{ name: string; content: string } | null>(null)
  const endRef      = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (!listening) inputRef.current?.focus() }, [listening])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  function submit() {
    let text = input.trim()
    if (!text && !fileCtx) return
    if (streaming) return
    if (fileCtx) {
      text = `[File: ${fileCtx.name}]\n\`\`\`\n${fileCtx.content}\n\`\`\`\n\n${text}`
      setFileCtx(null)
    }
    setInput('')
    onSend(text)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let text = reader.result as string
      if (text.length > 3000) text = text.slice(0, 3000) + '\n[…file truncated at 3000 chars]'
      setFileCtx({ name: file.name, content: text })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Minimal markdown → HTML
  function renderMarkdown(text: string): string {
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="code-block" data-lang="${lang}"><code>${code.trimEnd()}</code></pre>`)
      .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/^[*\-] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, '<ul>$&</ul>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
    return `<p>${html}</p>`
  }

  const isOffline = ollamaOnline === false
  const statusColor = ollamaOnline === null ? '#888' : ollamaOnline ? '#4CAF50' : '#ef5350'
  const statusText  = ollamaOnline === null ? 'Checking…'
    : ollamaOnline ? settings.model : 'AI offline'

  return (
    <div className="chat-bubble">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="status-pill">
          <span className="status-dot" style={{ background: statusColor }} />
          <span className="status-label">{statusText}</span>
          {speaking && <span className="tts-indicator" title="Speaking…">🔊</span>}
        </div>
        <div className="header-actions">
          {voiceSupported && (
            <button
              className={`icon-btn ${ttsEnabled ? 'tts-on' : ''}`}
              title={ttsEnabled ? 'TTS on — click to mute' : 'TTS off — click to enable'}
              onClick={onToggleTts}
            >
              {ttsEnabled ? '🔊' : '🔇'}
            </button>
          )}
          <button className="icon-btn" title="Settings" onClick={onOpenSettings}>⚙</button>
          <button className="icon-btn" title="Clear history" onClick={onClearHistory}>🗑</button>
          <button className="icon-btn close-btn" title="Close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Offline pill ─────────────────────────────────────────────── */}
      {isOffline && (
        <div className="offline-banner">
          AI engine not running. Quit and relaunch Patti, or check that Ollama is open.
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="messages-list">
        {messages.length === 0 && !isOffline && (
          <div className="empty-state">
            <span>👋 Hi! I'm your desktop companion.</span>
            <span>{voiceSupported ? 'Type or hold 🎙 to talk!' : 'Ask me anything!'}</span>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool') return null  // tool results are LLM-only context
          if (msg.role === 'assistant' && !msg.content) return null  // empty placeholder
          return (
            <div key={i} className={`message ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <div
                  className="message-content markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) || '…' }}
                />
              ) : (
                <div className="message-content">{msg.content}</div>
              )}
            </div>
          )
        })}

        {activeTool && (
          <div className="tool-status-row">
            <span className="tool-status-spinner" />
            <span className="tool-status-label">🛠 {activeTool}…</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── File chip (shown when a file is attached) ────────────────── */}
      {fileCtx && (
        <div className="file-chip-row">
          <div className="file-chip">
            <span className="file-chip-icon">📄</span>
            <span className="file-chip-name">{fileCtx.name}</span>
            <button className="file-chip-remove" onClick={() => setFileCtx(null)} title="Remove file">✕</button>
          </div>
        </div>
      )}

      {/* ── Input row ────────────────────────────────────────────────── */}
      <div className="input-row">
        {/* Hidden file picker */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".txt,.md,.csv,.json,.log"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {/* Attach button */}
        <button
          className={`attach-btn ${fileCtx ? 'has-file' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          title="Attach a text file"
          disabled={streaming}
        >
          📎
        </button>

        {/* Mic button */}
        {voiceSupported && (
          <button
            className={`mic-btn ${listening ? 'listening' : ''}`}
            onPointerDown={onMicDown}
            onPointerUp={onMicUp}
            onPointerLeave={onMicUp}
            title="Hold to speak"
            disabled={streaming}
          >
            {listening ? '🔴' : '🎙'}
          </button>
        )}

        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          placeholder={
            listening  ? 'Listening… release to send'
            : streaming ? 'Thinking…'
            : fileCtx   ? 'Add a message for the file… (Enter to send)'
            : 'Type a message… (Enter to send)'
          }
          value={input}
          disabled={(streaming && input === '') || listening}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {streaming ? (
          <button className="send-btn stop" onClick={onStop} title="Stop">■</button>
        ) : (
          <button
            className="send-btn"
            onClick={submit}
            disabled={(!input.trim() && !fileCtx) || isOffline}
            title="Send (Enter)"
          >▶</button>
        )}
      </div>

      <div className="bubble-tail" />
    </div>
  )
}

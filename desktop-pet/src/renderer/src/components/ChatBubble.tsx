import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { Message, OllamaSettings } from '../hooks/useOllama'

interface Props {
  messages: Message[]
  streaming: boolean
  ollamaOnline: boolean | null
  onSend: (text: string) => void
  onStop: () => void
  onClose: () => void
  onClearHistory: () => void
  onOpenSettings: () => void
  settings: OllamaSettings
}

export default function ChatBubble({
  messages, streaming, ollamaOnline,
  onSend, onStop, onClose, onClearHistory, onOpenSettings, settings
}: Props) {
  const [input, setInput] = useState('')
  const endRef    = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    onSend(text)
  }

  // Minimal markdown → HTML (code blocks, inline code, bold, italic, lists)
  function renderMarkdown(text: string): string {
    let html = text
      // Escape HTML entities first
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Fenced code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="code-block" data-lang="${lang}"><code>${code.trimEnd()}</code></pre>`)
      // Inline code
      .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      // Unordered lists
      .replace(/^[*\-] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, '<ul>$&</ul>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Paragraphs: double newline → break
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

    return `<p>${html}</p>`
  }

  const statusColor = ollamaOnline === null ? '#888' : ollamaOnline ? '#4CAF50' : '#ef5350'
  const statusText  = ollamaOnline === null ? 'checking…' : ollamaOnline ? settings.model : 'Ollama offline'

  return (
    <div className="chat-bubble">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="status-pill">
          <span className="status-dot" style={{ background: statusColor }} />
          <span className="status-label">{statusText}</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Settings" onClick={onOpenSettings}>⚙</button>
          <button className="icon-btn" title="Clear history" onClick={onClearHistory}>🗑</button>
          <button className="icon-btn close-btn" title="Close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="messages-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <span>👋 Hi! I'm Igachi.</span>
            <span>Ask me anything!</span>
            {!ollamaOnline && (
              <span className="offline-hint">
                Start Ollama with:<br />
                <code>ollama run {settings.model}</code>
              </span>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
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
        ))}
        <div ref={endRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────── */}
      <div className="input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          placeholder={streaming ? 'Generating…' : 'Ask me anything… (Enter to send)'}
          value={input}
          disabled={streaming && input === ''}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {streaming ? (
          <button className="send-btn stop" onClick={onStop} title="Stop">■</button>
        ) : (
          <button
            className="send-btn"
            onClick={submit}
            disabled={!input.trim()}
            title="Send (Enter)"
          >▶</button>
        )}
      </div>

      {/* Bubble tail pointing to pet */}
      <div className="bubble-tail" />
    </div>
  )
}

import { useState, useRef, ChangeEvent } from 'react'
import type { OllamaSettings } from '../hooks/useOllama'

interface Props {
  settings: OllamaSettings
  availableModels: string[]
  onSave: (updates: Partial<OllamaSettings>) => void
  onClose: () => void
  onCheckOllama: () => void
}

export default function SettingsPanel({
  settings, availableModels, onSave, onClose, onCheckOllama
}: Props) {
  const [model,        setModel]        = useState(settings.model)
  const [baseUrl,      setBaseUrl]      = useState(settings.baseUrl)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [memory,       setMemory]       = useState(localStorage.getItem('pet-memory') ?? '')
  const [memoryName,   setMemoryName]   = useState(localStorage.getItem('pet-memory-name') ?? '')
  const memoryInputRef = useRef<HTMLInputElement>(null)

  function save() {
    onSave({ model, baseUrl, systemPrompt })
    onClose()
  }

  function onMemoryFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      localStorage.setItem('pet-memory', text)
      localStorage.setItem('pet-memory-name', file.name)
      setMemory(text)
      setMemoryName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function clearMemory() {
    localStorage.removeItem('pet-memory')
    localStorage.removeItem('pet-memory-name')
    setMemory('')
    setMemoryName('')
  }

  const memoryChars = memory.length
  const memoryWarn  = memoryChars > 1500

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span>Settings</span>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="settings-body">
        <label>
          Ollama URL
          <input
            className="settings-input"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </label>

        <label>
          Model
          <div className="model-row">
            <input
              className="settings-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="qwen3:4b"
              list="model-list"
            />
            <datalist id="model-list">
              {availableModels.map(m => <option key={m} value={m} />)}
            </datalist>
            <button className="settings-check-btn" onClick={onCheckOllama}>Refresh</button>
          </div>
          {availableModels.length > 0 && (
            <div className="model-chips">
              {availableModels.map(m => (
                <button
                  key={m}
                  className={`model-chip ${m === model ? 'active' : ''}`}
                  onClick={() => setModel(m)}
                >{m}</button>
              ))}
            </div>
          )}
        </label>

        <label>
          System Prompt
          <textarea
            className="settings-textarea"
            rows={5}
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
          />
        </label>

        {/* ── Personal Memory ──────────────────────────────────────── */}
        <div className="memory-section">
          <p className="memory-section-title">🧠 Personal Memory</p>
          <p className="memory-section-desc">
            Load a text file Patti will always remember — your name, doctor info,
            preferences, family members, etc. Stored only on your device.
          </p>

          <input
            type="file"
            ref={memoryInputRef}
            accept=".txt,.md"
            style={{ display: 'none' }}
            onChange={onMemoryFile}
          />

          {memory ? (
            <div className="memory-loaded-wrap">
              <p className="memory-loaded">
                ✅ <strong>{memoryName}</strong> — {memoryChars.toLocaleString()} characters loaded
              </p>
              {memoryWarn && (
                <p className="memory-warn">
                  ⚠️ Large memory files use more AI tokens per message. Try to keep it under 1,500 characters.
                </p>
              )}
              <div className="memory-btn-row">
                <button className="memory-replace-btn" onClick={() => memoryInputRef.current?.click()}>
                  Replace file
                </button>
                <button className="memory-clear-btn" onClick={clearMemory}>
                  Clear memory
                </button>
              </div>
            </div>
          ) : (
            <button className="memory-load-btn" onClick={() => memoryInputRef.current?.click()}>
              📂 Load from file…
            </button>
          )}
        </div>

        <div className="settings-hint">
          Recommended for Patti's tool use: <code>qwen3:4b</code> (default),&nbsp;
          <code>qwen3:8b</code> (smarter), <code>qwen3:1.7b</code> (lightest)
        </div>
      </div>

      <div className="settings-footer">
        <button className="settings-cancel" onClick={onClose}>Cancel</button>
        <button className="settings-save"   onClick={save}>Save</button>
      </div>
    </div>
  )
}

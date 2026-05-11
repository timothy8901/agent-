import { useState } from 'react'
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

  function save() {
    onSave({ model, baseUrl, systemPrompt })
    onClose()
  }

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
              placeholder="qwen2.5:3b"
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

        <div className="settings-hint">
          Recommended models: <code>qwen2.5:3b</code> (fast),&nbsp;
          <code>qwen2.5:7b</code> (balanced), <code>qwen2.5:14b</code> (best)
        </div>
      </div>

      <div className="settings-footer">
        <button className="settings-cancel" onClick={onClose}>Cancel</button>
        <button className="settings-save"   onClick={save}>Save</button>
      </div>
    </div>
  )
}

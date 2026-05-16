import { useEffect, useRef, useState } from 'react'
import { pullModel, isOllamaAlive, listInstalledModels } from '../lib/ollamaPull'
import type { InstallProgress } from '../../../shared/installTypes'

interface Props {
  baseUrl: string
  chatModel: string          // e.g. 'qwen3:4b'
  visionModel: string        // e.g. 'moondream'
  onClose: () => void        // called once everything is ready
}

type Phase =
  | 'intro'
  | 'installing-ollama'
  | 'pulling-llm'
  | 'pulling-vision'
  | 'done'
  | 'error'

export default function WelcomePanel({ baseUrl, chatModel, visionModel, onClose }: Props) {
  const [phase,   setPhase]   = useState<Phase>('intro')
  const [label,   setLabel]   = useState<string>('')
  const [percent, setPercent] = useState<number>(0)
  const [error,   setError]   = useState<string>('')
  const unsubRef = useRef<(() => void) | null>(null)

  // Detach progress listener on unmount.
  useEffect(() => () => unsubRef.current?.(), [])

  async function ensureModel(model: string, prefix: Phase) {
    setPhase(prefix)
    setPercent(0)
    setLabel(`Preparing ${model}…`)
    const installed = await listInstalledModels(baseUrl)
    if (installed.includes(model) || installed.some(m => m.startsWith(model))) return
    const ok = await pullModel({
      baseUrl, model, labelPrefix: `Downloading ${model}`,
      onProgress: (p) => { setPercent(p.percent); setLabel(p.label) },
    })
    if (!ok) throw new Error(`Could not download ${model}.`)
  }

  async function run() {
    try {
      setError('')
      // 1. Ollama
      if (!(await isOllamaAlive(baseUrl))) {
        setPhase('installing-ollama')
        setLabel('Preparing Ollama…')
        unsubRef.current?.()
        unsubRef.current = window.electronAPI.onInstallProgress((p: InstallProgress) => {
          setLabel(p.label)
        })
        const r = await window.electronAPI.installOllama()
        unsubRef.current?.()
        if (!r.ok) throw new Error(r.error ?? 'Could not install Ollama.')
      }
      // 2. Chat model
      await ensureModel(chatModel, 'pulling-llm')
      // 3. Vision model
      await ensureModel(visionModel, 'pulling-vision')

      setPhase('done')
      setLabel('All set — Patti is ready!')
      localStorage.setItem('first-run-complete', '1')
      setTimeout(onClose, 700)
    } catch (err) {
      setPhase('error')
      setError((err as Error).message)
    }
  }

  return (
    <div className="welcome-panel">
      <div className="welcome-header">
        <span className="welcome-title">👋 Meet Patti</span>
      </div>

      <div className="welcome-body">
        {phase === 'intro' && (
          <>
            <p className="welcome-lead">
              Patti is your local desktop pet. She runs entirely on your Mac — no cloud, no tracking.
            </p>

            <div className="welcome-steps">
              <p className="welcome-step"><span className="welcome-step-num">1</span>Installs Ollama (free, runs the AI on-device)</p>
              <p className="welcome-step"><span className="welcome-step-num">2</span>Downloads a small chat model (~2.5 GB)</p>
              <p className="welcome-step"><span className="welcome-step-num">3</span>Downloads a tiny vision model (~1.7 GB)</p>
            </div>

            <div className="welcome-perms">
              <p className="welcome-perms-title">You'll be asked to allow:</p>
              <ul>
                <li>📺 <strong>Screen Recording</strong> — so Patti can see what you're working on</li>
                <li>📅 <strong>Calendar</strong> — so Patti can check and add events</li>
                <li>🔔 <strong>Notifications</strong> — so reminders actually fire</li>
              </ul>
            </div>

            <button className="welcome-cta" onClick={run}>Set me up</button>
            <button className="welcome-skip" onClick={onClose}>I'll do this later</button>
          </>
        )}

        {(phase === 'installing-ollama' || phase === 'pulling-llm' || phase === 'pulling-vision') && (
          <div className="welcome-progress">
            <p className="welcome-progress-title">
              {phase === 'installing-ollama' && '⚙ Installing Ollama'}
              {phase === 'pulling-llm'        && '🧠 Downloading chat model'}
              {phase === 'pulling-vision'     && '👁 Downloading vision model'}
            </p>
            {phase !== 'installing-ollama' && (
              <div className="welcome-bar-bg">
                <div className="welcome-bar-fill" style={{ width: `${percent}%` }} />
              </div>
            )}
            <p className="welcome-progress-label">{label}</p>
            <p className="welcome-hint">First-time downloads can take a few minutes.</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="welcome-done">
            <p className="welcome-done-icon">✨</p>
            <p>{label}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="welcome-error">
            <p className="welcome-error-icon">⚠️</p>
            <p className="welcome-error-text">{error}</p>
            <button className="welcome-cta" onClick={run}>Try again</button>
            <button className="welcome-skip" onClick={onClose}>Skip for now</button>
          </div>
        )}
      </div>
    </div>
  )
}

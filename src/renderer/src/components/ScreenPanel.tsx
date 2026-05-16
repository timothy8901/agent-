import type { ScreenContextState } from '../hooks/useScreenContext'

interface Props {
  state:   ScreenContextState
  petName: string
  onEnable:  () => void
  onDisable: () => void
  onClose:   () => void
}

const CONTEXT_LABELS: Record<string, string> = {
  video:   '🍿 Watching something',
  coding:  '💻 Coding / working',
  gaming:  '🎮 Gaming',
  email:   '✉️ Writing emails',
  unknown: '👀 Observing…',
}

export default function ScreenPanel({ state, petName, onEnable, onDisable, onClose }: Props) {
  const { setupStatus, pullProgress, pullLabel, active, context, rawLabel, isAnalyzing } = state

  return (
    <div className="screen-panel">
      <div className="chat-header">
        <span className="panel-title">🖥 Screen Reactions</span>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="screen-body">
        {/* ── Idle / explainer ─────────────────────────────────── */}
        {setupStatus === 'idle' && (
          <>
            <div className="screen-explainer">
              <div className="screen-explainer-icon">🎬</div>
              <h3 className="screen-explainer-title">Your pet comes alive with your screen</h3>
              <p className="screen-explainer-desc">
                {petName} uses a small AI model — running entirely on <em>your</em> computer,
                never the internet — to peek at what's on your screen every minute.
                Streaming a movie? They'll grab popcorn. Deep in a coding session? They'll
                go quiet. Gaming? They'll cheer you on.
              </p>
              <ul className="screen-preview-list">
                <li>🍿 Netflix / YouTube → watches along with you</li>
                <li>🤫 VS Code / terminal → respects your focus</li>
                <li>🎮 Games → hypes you up</li>
                <li>✉️ Email → offers to help draft</li>
              </ul>
              <p className="screen-privacy-note">
                🔒 Everything stays on your device. No data is sent anywhere.
              </p>
            </div>
            <button className="screen-enable-btn" onClick={onEnable}>
              Enable Screen Reactions
            </button>
          </>
        )}

        {/* ── Checking Ollama ───────────────────────────────────── */}
        {setupStatus === 'checking' && (
          <div className="screen-status-wrap">
            <div className="screen-spinner" />
            <p className="screen-status-text">Checking AI engine…</p>
          </div>
        )}

        {/* ── Pulling model ─────────────────────────────────────── */}
        {setupStatus === 'pulling' && (
          <div className="screen-pull-wrap">
            <p className="screen-pull-title">Downloading vision model</p>
            <p className="screen-pull-sub">
              One-time download — about 1.7 GB. This only happens once!
            </p>
            <div className="screen-pull-bar-bg">
              <div
                className="screen-pull-bar-fill"
                style={{ width: `${pullProgress}%` }}
              />
            </div>
            <p className="screen-pull-label">{pullLabel || 'Starting…'}</p>
            <button className="screen-cancel-btn" onClick={onDisable}>Cancel</button>
          </div>
        )}

        {/* ── No Ollama ─────────────────────────────────────────── */}
        {setupStatus === 'no-ollama' && (
          <div className="screen-status-wrap">
            <p className="screen-status-icon">⚠️</p>
            <p className="screen-status-text">Ollama isn't running</p>
            <p className="screen-status-hint">
              Screen Reactions need Ollama installed and running in the background.
              It's free and takes about 2 minutes to set up.
            </p>
            <p className="screen-status-hint">
              After installing, open it once and come back here.
            </p>
            <button className="screen-enable-btn" onClick={onEnable}>Try again</button>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {setupStatus === 'error' && (
          <div className="screen-status-wrap">
            <p className="screen-status-icon">❌</p>
            <p className="screen-status-text">Something went wrong</p>
            <p className="screen-status-hint">{state.error}</p>
            <button className="screen-enable-btn" onClick={onEnable}>Try again</button>
          </div>
        )}

        {/* ── Active ───────────────────────────────────────────── */}
        {setupStatus === 'ready' && active && (
          <>
            <div className="screen-active-header">
              <span className="screen-active-dot" />
              <span className="screen-active-label">Screen Reactions active</span>
              {isAnalyzing && <span className="screen-analyzing-badge">analyzing…</span>}
            </div>

            <div className="screen-context-card">
              <span className="screen-context-emoji">
                {context === 'video'  ? '🍿'
               : context === 'coding' ? '💻'
               : context === 'gaming' ? '🎮'
               : context === 'email'  ? '✉️'
               : '👀'}
              </span>
              <div>
                <p className="screen-context-label">
                  {CONTEXT_LABELS[context] ?? 'Watching…'}
                </p>
                {rawLabel && (
                  <p className="screen-context-raw">
                    Detected: <em>{rawLabel}</em>
                  </p>
                )}
              </div>
            </div>

            <p className="screen-scan-note">
              {petName} checks your screen every 60 seconds.
            </p>

            <button className="screen-cancel-btn" onClick={onDisable}>
              Turn off Screen Reactions
            </button>
          </>
        )}
      </div>
    </div>
  )
}

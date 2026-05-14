import { useState, useEffect, useCallback, useRef } from 'react'
import PetCanvas          from './components/PetCanvas'
import ChatBubble         from './components/ChatBubble'
import SettingsPanel      from './components/SettingsPanel'
import CustomizationPanel from './components/CustomizationPanel'
import GamesPanel         from './components/GamesPanel'
import { useOllama }      from './hooks/useOllama'
import { usePetAppearance } from './hooks/usePetAppearance'
import { useVision }      from './hooks/useVision'
import { useVoice }       from './hooks/useVoice'
import { useScreenContext, type ScreenContextType } from './hooks/useScreenContext'
import type { PetAnim }   from './components/PetCanvas'

declare global {
  interface Window {
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void
      setExpanded:          (expand: boolean) => void
      dragStart:  (pos: { mouseX: number; mouseY: number }) => void
      dragMove:   (pos: { mouseX: number; mouseY: number }) => void
      dragEnd:    () => void
      showContextMenu: () => void
      captureScreen:   () => Promise<string | null>
    }
  }
}

type Panel = null | 'chat' | 'customize' | 'games' | 'vision'

const SCREEN_REACTIONS: Record<ScreenContextType, { anim: PetAnim; msg: string } | null> = {
  video:   { anim: 'EATING',   msg: "Ooh, what are we watching? 🍿 Scoot over!" },
  coding:  { anim: 'THINKING', msg: "Deep work mode detected. I'll stay quiet 🤫" },
  gaming:  { anim: 'HAPPY',    msg: "GAME TIME! Let's GOOO! 🎮" },
  email:   { anim: 'WAVING',   msg: "Writing emails? I can help draft one — just ask!" },
  unknown: null,
}

export default function App() {
  const [panel,        setPanel]        = useState<Panel>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [petAnim,      setPetAnim]      = useState<PetAnim>('IDLE')
  const [editingName,  setEditingName]  = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const {
    messages, streaming, ollamaOnline, availableModels,
    settings, updateSettings,
    send, stopGeneration, clearHistory, checkOllama
  } = useOllama()

  const { appearance, petName, setColor, setFace, setEar, setPetName } = usePetAppearance()

  // ── Motion / camera ────────────────────────────────────────────────────
  const handleMotion = useCallback(() => {
    if (petAnim === 'IDLE' || petAnim === 'SLEEPING') {
      setPetAnim('WAVING')
      setTimeout(() => setPetAnim('IDLE'), 1500)
    }
  }, [petAnim])

  const { state: vision, startCamera, stopCamera, analyzeFrame } = useVision(
    settings.baseUrl, handleMotion
  )

  // ── Voice I/O ──────────────────────────────────────────────────────────
  const voice = useVoice(useCallback((text: string) => {
    send(text)
  }, [send]))

  // Speak assistant replies when TTS enabled
  const lastMsgCount = useRef(messages.length)
  useEffect(() => {
    if (messages.length > lastMsgCount.current) {
      const last = messages[messages.length - 1]
      if (last.role === 'assistant' && !streaming) {
        setPetAnim('HAPPY')
        const t = setTimeout(() => setPetAnim('IDLE'), 1800)
        lastMsgCount.current = messages.length
        if (voice.state.ttsEnabled) voice.speak(last.content)
        return () => clearTimeout(t)
      }
    }
    lastMsgCount.current = messages.length
    return undefined
  }, [messages, streaming, voice.state.ttsEnabled])

  // ── Screen context ─────────────────────────────────────────────────────
  const [screenWatching, setScreenWatching] = useState(false)
  const screenCtx = useScreenContext(settings.baseUrl)

  useEffect(() => {
    if (screenWatching) screenCtx.start()
    else screenCtx.stop()
  }, [screenWatching])

  // React when screen context changes
  useEffect(() => {
    const reaction = SCREEN_REACTIONS[screenCtx.state.context]
    if (!reaction || !screenCtx.state.active) return
    setPetAnim(reaction.anim)
    setTimeout(() => setPetAnim('IDLE'), 4000)
    // Inject as chat message (will auto-send to LLM if chat open)
    if (panel === 'chat') send(`[Screen]: ${reaction.msg}`)
  }, [screenCtx.state.context])

  // ── Sync anim with LLM ────────────────────────────────────────────────
  useEffect(() => {
    if (streaming) { setPetAnim('TALKING'); return }
    if (panel === 'chat') {
      setPetAnim('WAVING')
      const t = setTimeout(() => setPetAnim('IDLE'), 1200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [streaming, panel])

  // ── Expand / collapse ─────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.setExpanded(panel !== null)
    if (panel === 'chat') checkOllama()
    if (panel === 'vision' && !vision.active) startCamera()
    if (panel !== 'vision' && vision.active) stopCamera()
  }, [panel])

  // ── Vision → chat ─────────────────────────────────────────────────────
  useEffect(() => {
    if (vision.lastReaction && panel === 'chat') {
      send(`[Vision reaction]: ${vision.lastReaction}`)
    }
  }, [vision.lastReaction])

  // ── Click-through ─────────────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      window.electronAPI.setIgnoreMouseEvents(el?.closest('[data-interactive]') === null)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  // ── Drag ──────────────────────────────────────────────────────────────
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0 })

  const onPetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { window.electronAPI.showContextMenu(); return }
    dragState.current = { dragging: true, moved: false, startX: e.screenX, startY: e.screenY }
    window.electronAPI.dragStart({ mouseX: e.screenX, mouseY: e.screenY })

    function onMove(me: MouseEvent) {
      const dx = Math.abs(me.screenX - dragState.current.startX)
      const dy = Math.abs(me.screenY - dragState.current.startY)
      if (dx > 4 || dy > 4) dragState.current.moved = true
      if (dragState.current.moved)
        window.electronAPI.dragMove({ mouseX: me.screenX, mouseY: me.screenY })
    }
    function onUp() {
      window.electronAPI.dragEnd()
      if (!dragState.current.moved) togglePanel('chat')
      dragState.current.dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? null : p)
    setSettingsOpen(false)
  }

  // ── Name edit ─────────────────────────────────────────────────────────
  function startEditName(e: React.MouseEvent) {
    e.stopPropagation()
    setNameInput(petName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 30)
  }
  function commitName() {
    if (nameInput.trim()) setPetName(nameInput)
    setEditingName(false)
  }
  function onNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitName()
    if (e.key === 'Escape') setEditingName(false)
  }

  const activeToolbar: Record<NonNullable<Panel>, boolean> = {
    chat:      panel === 'chat',
    customize: panel === 'customize',
    games:     panel === 'games',
    vision:    panel === 'vision',
  }

  return (
    <div className="app-root">
      {/* ── Overlay panel area ───────────────────────────────── */}
      {panel !== null && !settingsOpen && (
        <div className="overlay-area" data-interactive="">
          {panel === 'chat' && (
            <ChatBubble
              messages={messages} streaming={streaming}
              ollamaOnline={ollamaOnline} settings={settings}
              onSend={send} onStop={stopGeneration}
              onClose={() => setPanel(null)}
              onClearHistory={clearHistory}
              onOpenSettings={() => setSettingsOpen(true)}
              listening={voice.state.listening}
              speaking={voice.state.speaking}
              voiceSupported={voice.state.supported}
              ttsEnabled={voice.state.ttsEnabled}
              onMicDown={voice.startListening}
              onMicUp={voice.stopListening}
              onToggleTts={voice.toggleTts}
            />
          )}
          {panel === 'customize' && (
            <CustomizationPanel
              appearance={appearance} petName={petName}
              onSetColor={setColor} onSetFace={setFace} onSetEar={setEar}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'games' && (
            <GamesPanel
              appearance={appearance} petName={petName}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'vision' && (
            <VisionPanel
              vision={vision} petName={petName}
              onAnalyze={() => analyzeFrame(petName)}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}

      {panel === 'chat' && settingsOpen && (
        <div className="overlay-area" data-interactive="">
          <SettingsPanel
            settings={settings} availableModels={availableModels}
            onSave={updateSettings} onClose={() => setSettingsOpen(false)}
            onCheckOllama={() => checkOllama(settings.baseUrl)}
          />
        </div>
      )}

      {/* ── Pet area ─────────────────────────────────────────── */}
      <div className="pet-area" data-interactive="">
        <div
          className="pet-canvas-wrap"
          onMouseDown={onPetMouseDown}
          onContextMenu={e => e.preventDefault()}
          title={panel === 'chat' ? 'Click to close chat' : 'Click to chat • Drag to move'}
        >
          <PetCanvas anim={petAnim} appearance={appearance} size={150} />

          {vision.active && panel !== 'vision' && (
            <div
              className="motion-bar"
              style={{ width: `${vision.motionLevel}%` }}
              title={`Motion: ${vision.motionLevel}%`}
            />
          )}
        </div>

        {/* Inline name edit */}
        <div className="pet-name-row" data-interactive="">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="pet-name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={onNameKey}
              maxLength={20}
            />
          ) : (
            <button className="pet-name-btn" onClick={startEditName} title="Click to rename">
              {petName} ✏️
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="pet-toolbar" data-interactive="">
          <ToolBtn icon="💬" label="Chat"    active={activeToolbar.chat}      onClick={() => togglePanel('chat')} />
          <ToolBtn icon="🎮" label="Games"   active={activeToolbar.games}     onClick={() => togglePanel('games')} />
          <ToolBtn icon="🎨" label="Style"   active={activeToolbar.customize} onClick={() => togglePanel('customize')} />
          <ToolBtn
            icon={vision.active ? '📷' : '📸'} label="Vision"
            active={activeToolbar.vision}
            onClick={() => togglePanel('vision')}
            dot={vision.active}
          />
          <ToolBtn
            icon="🖥" label="Screen"
            active={screenWatching}
            onClick={() => setScreenWatching(w => !w)}
            dot={screenWatching}
            loading={screenCtx.state.isAnalyzing}
          />
        </div>
      </div>
    </div>
  )
}

// ── Toolbar button ────────────────────────────────────────────────────────
function ToolBtn({ icon, label, active, dot, loading, onClick }: {
  icon: string; label: string; active: boolean
  dot?: boolean; loading?: boolean; onClick: () => void
}) {
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="tool-icon">{icon}</span>
      {dot && !loading && <span className="tool-dot" />}
      {loading && <span className="tool-dot loading-dot" />}
    </button>
  )
}

// ── Vision panel ─────────────────────────────────────────────────────────
function VisionPanel({ vision, petName, onAnalyze, onClose }: {
  vision: ReturnType<typeof useVision>['state']
  petName: string
  onAnalyze: () => void
  onClose: () => void
}) {
  return (
    <div className="vision-panel">
      <div className="chat-header">
        <span className="panel-title">📷 Vision</span>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="vision-body">
        {vision.error ? (
          <div className="vision-error">
            <span>❌ Camera error</span>
            <code>{vision.error}</code>
            <span>Grant camera permission and try again.</span>
          </div>
        ) : (
          <>
            <div className="vision-motion-wrap">
              <div className="vision-motion-label">
                Motion detector
                <span className={`vision-status-dot ${vision.active ? 'on' : 'off'}`} />
              </div>
              <div className="vision-meter-bg">
                <div
                  className="vision-meter-fill"
                  style={{
                    width: `${vision.motionLevel}%`,
                    background: vision.motionLevel > 60 ? '#ef5350'
                               : vision.motionLevel > 30 ? '#FF9800'
                               : '#4CAF50'
                  }}
                />
              </div>
              <p className="vision-hint">
                {vision.motionLevel > 30 ? `${petName} sees you! 👀`
                  : `Wave at your screen — ${petName} will wave back!`}
              </p>
            </div>
            <div className="vision-ai-section">
              <button className="vision-snap-btn" onClick={onAnalyze} disabled={vision.isAnalyzing}>
                {vision.isAnalyzing ? '🔍 Analyzing…' : `📸 Let ${petName} see you`}
              </button>
              {vision.lastReaction && (
                <div className="vision-reaction">
                  <span className="vision-reaction-label">{petName} says:</span>
                  <p>{vision.lastReaction}</p>
                </div>
              )}
              <p className="vision-hint">
                Needs a vision model:<br /><code>ollama pull moondream</code>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

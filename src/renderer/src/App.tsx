import { useState, useEffect, useCallback, useRef } from 'react'
import PetCanvas          from './components/PetCanvas'
import ChatBubble         from './components/ChatBubble'
import SettingsPanel      from './components/SettingsPanel'
import CustomizationPanel from './components/CustomizationPanel'
import GamesPanel         from './components/GamesPanel'
import ScreenPanel        from './components/ScreenPanel'
import WelcomePanel       from './components/WelcomePanel'
import AlarmsPanel        from './components/AlarmsPanel'
import { useOllama }      from './hooks/useOllama'
import { usePetAppearance } from './hooks/usePetAppearance'
import { useVoice }       from './hooks/useVoice'
import { useScreenContext, type ScreenContextType } from './hooks/useScreenContext'
import type { PetAnim }   from './components/PetCanvas'
import type { ToolCallPayload, ToolResultPayload } from '../../shared/tools'
import type { InstallProgress } from '../../shared/installTypes'

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
      invokeTool:      (call: ToolCallPayload) => Promise<ToolResultPayload>
      ollamaStatus:    () => Promise<{ installed: boolean; running: boolean }>
      installOllama:   () => Promise<{ ok: boolean; error?: string }>
      onInstallProgress: (cb: (p: InstallProgress) => void) => () => void
    }
  }
}

type Panel = null | 'chat' | 'customize' | 'games' | 'vision' | 'alarms'

const SCREEN_REACTIONS: Record<ScreenContextType, { anim: PetAnim; msg: string } | null> = {
  video:   { anim: 'EATING',   msg: "Ooh, what are we watching? 🍿 Scoot over!" },
  coding:  { anim: 'THINKING', msg: "Deep work mode detected. I'll stay quiet 🤫" },
  gaming:  { anim: 'HAPPY',    msg: "GAME TIME! Let's GOOO! 🎮" },
  email:   { anim: 'WAVING',   msg: "Writing emails? I can help draft one — just ask!" },
  unknown: null,
}

const CHAT_MODEL   = 'qwen3:4b'
const VISION_MODEL = 'moondream'

export default function App() {
  const [panel,        setPanel]        = useState<Panel>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [petAnim,      setPetAnim]      = useState<PetAnim>('IDLE')
  const [editingName,  setEditingName]  = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [showWelcome,  setShowWelcome]  = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const {
    messages, streaming, ollamaOnline, availableModels, activeTool,
    settings, updateSettings,
    send, stopGeneration, clearHistory, checkOllama
  } = useOllama()

  const { appearance, petName, setColor, setFace, setEar, setPetName } = usePetAppearance()

  // ── Voice I/O ──────────────────────────────────────────────────────────
  const voice = useVoice(useCallback((text: string) => {
    send(text)
  }, [send]))

  // Speak assistant replies when TTS enabled
  const lastMsgCount = useRef(messages.length)
  useEffect(() => {
    if (messages.length > lastMsgCount.current) {
      const last = messages[messages.length - 1]
      if (last.role === 'assistant' && !streaming && last.content) {
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

  // ── Screen context (this IS the Vision feature now) ────────────────────
  const screenCtx = useScreenContext(settings.baseUrl)

  // React when screen context changes
  useEffect(() => {
    const reaction = SCREEN_REACTIONS[screenCtx.state.context]
    if (!reaction || !screenCtx.state.active) return
    setPetAnim(reaction.anim)
    setTimeout(() => setPetAnim('IDLE'), 4000)
    if (panel === 'chat') send(`[Screen]: ${reaction.msg}`)
  }, [screenCtx.state.context])

  // ── First-run detection ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function bootCheck() {
      await new Promise(r => setTimeout(r, 250))
      const done = localStorage.getItem('first-run-complete') === '1'
      if (cancelled) return
      await checkOllama()
      const status = await window.electronAPI.ollamaStatus()
      if (!done && !status.running) {
        if (!cancelled) setShowWelcome(true)
      }
    }
    bootCheck()
    return () => { cancelled = true }
  }, [checkOllama])

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
    window.electronAPI.setExpanded(panel !== null || showWelcome)
    if (panel === 'chat') checkOllama()
  }, [panel, showWelcome])

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
    alarms:    panel === 'alarms',
  }

  return (
    <div className="app-root">
      {/* ── First-run wizard ────────────────────────────────────── */}
      {showWelcome && (
        <div className="overlay-area" data-interactive="">
          <WelcomePanel
            baseUrl={settings.baseUrl}
            chatModel={CHAT_MODEL}
            visionModel={VISION_MODEL}
            onClose={() => {
              setShowWelcome(false)
              checkOllama()
            }}
          />
        </div>
      )}

      {/* ── Regular panel area ─────────────────────────────────── */}
      {!showWelcome && panel !== null && !settingsOpen && (
        <div className="overlay-area" data-interactive="">
          {panel === 'chat' && (
            <ChatBubble
              messages={messages} streaming={streaming}
              ollamaOnline={ollamaOnline} activeTool={activeTool}
              settings={settings}
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
            <ScreenPanel
              state={screenCtx.state}
              petName={petName}
              onEnable={screenCtx.setupAndStart}
              onDisable={screenCtx.stop}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'alarms' && (
            <AlarmsPanel
              petName={petName}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}

      {!showWelcome && panel === 'chat' && settingsOpen && (
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
        </div>

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

        <div className="pet-toolbar" data-interactive="">
          <ToolBtn icon="💬" label="Chat"      active={activeToolbar.chat}      onClick={() => togglePanel('chat')} />
          <ToolBtn icon="🎮" label="Games"     active={activeToolbar.games}     onClick={() => togglePanel('games')} />
          <ToolBtn icon="🎨" label="Style"     active={activeToolbar.customize} onClick={() => togglePanel('customize')} />
          <ToolBtn
            icon="👁" label="Vision"
            active={activeToolbar.vision}
            onClick={() => togglePanel('vision')}
            dot={screenCtx.state.active}
            loading={screenCtx.state.isAnalyzing}
          />
          <ToolBtn icon="⏰" label="Reminders" active={activeToolbar.alarms}    onClick={() => togglePanel('alarms')} />
        </div>
      </div>
    </div>
  )
}

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

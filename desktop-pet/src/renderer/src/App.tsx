import { useState, useEffect, useCallback, useRef } from 'react'
import PetCanvas, { PetAnim } from './components/PetCanvas'
import ChatBubble from './components/ChatBubble'
import SettingsPanel from './components/SettingsPanel'
import { useOllama } from './hooks/useOllama'

// Expose the electron API type
declare global {
  interface Window {
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void
      setExpanded: (expand: boolean) => void
      dragStart: (pos: { mouseX: number; mouseY: number }) => void
      dragMove:  (pos: { mouseX: number; mouseY: number }) => void
      dragEnd:   () => void
      showContextMenu: () => void
    }
  }
}

export default function App() {
  const [chatOpen,     setChatOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [petAnim,      setPetAnim]      = useState<PetAnim>('IDLE')
  const prevAnimRef = useRef<PetAnim>('IDLE')

  const {
    messages, streaming, ollamaOnline, availableModels,
    settings, updateSettings,
    send, stopGeneration, clearHistory, checkOllama
  } = useOllama()

  // ── Sync pet animation with LLM state ──────────────────────────────────
  useEffect(() => {
    if (streaming) {
      setPetAnim('TALKING')
    } else if (chatOpen) {
      setPetAnim('WAVING')
      const t = setTimeout(() => setPetAnim('IDLE'), 1200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [streaming, chatOpen])

  // ── Open chat → expand window ───────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.setExpanded(chatOpen)
    if (chatOpen) checkOllama()
  }, [chatOpen, checkOllama])

  // ── Happy animation after each assistant reply ──────────────────────────
  const lastMsgCount = useRef(messages.length)
  useEffect(() => {
    if (messages.length > lastMsgCount.current) {
      const last = messages[messages.length - 1]
      if (last.role === 'assistant' && !streaming) {
        setPetAnim('HAPPY')
        const t = setTimeout(() => setPetAnim('IDLE'), 1800)
        lastMsgCount.current = messages.length
        return () => clearTimeout(t)
      }
    }
    lastMsgCount.current = messages.length
    return undefined
  }, [messages, streaming])

  // ── Click-through: toggle based on mouse position ──────────────────────
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isInteractive = el?.closest('[data-interactive]') !== null
      window.electronAPI.setIgnoreMouseEvents(!isInteractive)
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [])

  // ── Drag logic ─────────────────────────────────────────────────────────
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0 })

  const onPetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { window.electronAPI.showContextMenu(); return }
    dragState.current = { dragging: true, moved: false, startX: e.screenX, startY: e.screenY }
    window.electronAPI.dragStart({ mouseX: e.screenX, mouseY: e.screenY })

    function onMove(me: MouseEvent) {
      const dx = Math.abs(me.screenX - dragState.current.startX)
      const dy = Math.abs(me.screenY - dragState.current.startY)
      if (dx > 4 || dy > 4) dragState.current.moved = true
      if (dragState.current.moved) {
        window.electronAPI.dragMove({ mouseX: me.screenX, mouseY: me.screenY })
      }
    }
    function onUp() {
      window.electronAPI.dragEnd()
      if (!dragState.current.moved) {
        // treat as click → toggle chat
        setChatOpen(prev => !prev)
      }
      dragState.current.dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [])

  // Prevent context menu (we handle right-click ourselves)
  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div ref={rootRef} className="app-root">
      {/* ── Chat / Settings overlay ─────────────────────────────── */}
      {chatOpen && (
        <div className="overlay-area" data-interactive="">
          {settingsOpen ? (
            <SettingsPanel
              settings={settings}
              availableModels={availableModels}
              onSave={updateSettings}
              onClose={() => setSettingsOpen(false)}
              onCheckOllama={() => checkOllama(settings.baseUrl)}
            />
          ) : (
            <ChatBubble
              messages={messages}
              streaming={streaming}
              ollamaOnline={ollamaOnline}
              settings={settings}
              onSend={send}
              onStop={stopGeneration}
              onClose={() => setChatOpen(false)}
              onClearHistory={clearHistory}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </div>
      )}

      {/* ── Pet ────────────────────────────────────────────────── */}
      <div
        className="pet-area"
        data-interactive=""
        onMouseDown={onPetMouseDown}
        onContextMenu={onContextMenu}
        title={chatOpen ? 'Click to close chat' : 'Click to chat • Right-click for menu'}
      >
        <PetCanvas anim={petAnim} size={164} />

        {/* Idle speech bubble hint */}
        {!chatOpen && (
          <div className="pet-hint">
            💬
          </div>
        )}
      </div>
    </div>
  )
}

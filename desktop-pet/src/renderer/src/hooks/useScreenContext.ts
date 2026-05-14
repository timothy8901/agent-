import { useState, useRef, useCallback, useEffect } from 'react'

export type ScreenContextType = 'video' | 'coding' | 'gaming' | 'email' | 'unknown'

export interface ScreenContextState {
  active:      boolean
  context:     ScreenContextType
  rawLabel:    string
  isAnalyzing: boolean
}

const SCAN_INTERVAL = 60_000 // ms between screen checks

function classify(label: string): ScreenContextType {
  const l = label.toLowerCase()
  if (/netflix|youtube|hulu|disney|twitch|video|movie|watch|streaming|vlc|plex/.test(l)) return 'video'
  if (/vscode|vs code|code|terminal|github|editor|programming|python|javascript|typescript|vim|emacs|cursor/.test(l)) return 'coding'
  if (/steam|game|roblox|minecraft|fortnite|valorant|gaming|overwatch|league/.test(l)) return 'gaming'
  if (/gmail|email|outlook|mail|inbox|compose/.test(l)) return 'email'
  return 'unknown'
}

export function useScreenContext(ollamaBaseUrl: string) {
  const [state, setState] = useState<ScreenContextState>({
    active:      false,
    context:     'unknown',
    rawLabel:    '',
    isAnalyzing: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevContext  = useRef<ScreenContextType>('unknown')

  const analyze = useCallback(async (): Promise<ScreenContextType | null> => {
    if (!window.electronAPI?.captureScreen) return null
    setState(prev => ({ ...prev, isAnalyzing: true }))

    try {
      const dataUrl = await window.electronAPI.captureScreen()
      if (!dataUrl) { setState(prev => ({ ...prev, isAnalyzing: false })); return null }

      // Find a vision model
      let visionModel: string | null = null
      try {
        const res = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json() as { models: { name: string }[] }
          const models = data.models?.map(m => m.name) ?? []
          visionModel =
            models.find(m => /moondream|llava|minicpm|vision|vl/i.test(m)) ?? null
        }
      } catch { /* offline */ }

      if (!visionModel) {
        setState(prev => ({ ...prev, isAnalyzing: false }))
        return null
      }

      const b64 = dataUrl.split(',')[1]
      const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: visionModel,
          prompt: 'In 2-4 words only, what is the main app or website visible on this screen? Examples: "YouTube video playing", "VS Code editor", "Gmail inbox", "Steam gaming". Be very brief.',
          images: [b64],
          stream: false,
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as { response: string }
      const raw = data.response?.trim() ?? ''
      const ctx = classify(raw)

      setState(prev => ({ ...prev, isAnalyzing: false, rawLabel: raw, context: ctx }))
      return ctx
    } catch {
      setState(prev => ({ ...prev, isAnalyzing: false }))
      return null
    }
  }, [ollamaBaseUrl])

  const start = useCallback(() => {
    setState(prev => ({ ...prev, active: true }))
    analyze()
    intervalRef.current = setInterval(analyze, SCAN_INTERVAL)
  }, [analyze])

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setState(prev => ({ ...prev, active: false, context: 'unknown', rawLabel: '' }))
    prevContext.current = 'unknown'
  }, [])

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  // Returns true when context changed to a new non-unknown value
  const didContextChange = state.context !== 'unknown' && state.context !== prevContext.current
  if (didContextChange) prevContext.current = state.context

  return { state, start, stop, didContextChange }
}

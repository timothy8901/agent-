import { useState, useRef, useCallback, useEffect } from 'react'

export type ScreenContextType = 'video' | 'coding' | 'gaming' | 'email' | 'unknown'

export type SetupStatus =
  | 'idle'        // never tried
  | 'checking'    // pinging Ollama
  | 'pulling'     // downloading model
  | 'ready'       // model present, monitoring active
  | 'no-ollama'   // Ollama not reachable
  | 'error'       // pull or analysis failed

export interface ScreenContextState {
  active:      boolean
  setupStatus: SetupStatus
  pullProgress: number       // 0-100 during download
  pullLabel:   string        // e.g. "Downloading vision model… 47%"
  context:     ScreenContextType
  rawLabel:    string
  isAnalyzing: boolean
  error:       string | null
}

const SCAN_INTERVAL = 60_000
const VISION_MODEL  = 'moondream'

function classify(label: string): ScreenContextType {
  const l = label.toLowerCase()
  if (/netflix|youtube|hulu|disney|twitch|video|movie|watch|streaming|vlc|plex/.test(l)) return 'video'
  if (/vscode|vs code|code|terminal|github|editor|programming|python|javascript|typescript|vim|emacs|cursor/.test(l)) return 'coding'
  if (/steam|game|roblox|minecraft|fortnite|valorant|gaming|overwatch|league/.test(l)) return 'gaming'
  if (/gmail|email|outlook|mail|inbox|compose/.test(l)) return 'email'
  return 'unknown'
}

async function findVisionModel(baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data = await res.json() as { models: { name: string }[] }
    const models = data.models?.map(m => m.name) ?? []
    return models.find(m => /moondream|llava|minicpm|vision|vl/i.test(m)) ?? null
  } catch { return null }
}

export function useScreenContext(ollamaBaseUrl: string) {
  const [state, setState] = useState<ScreenContextState>({
    active: false, setupStatus: 'idle', pullProgress: 0, pullLabel: '',
    context: 'unknown', rawLabel: '', isAnalyzing: false, error: null,
  })
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevContext    = useRef<ScreenContextType>('unknown')
  const visionModelRef = useRef<string | null>(null)
  const abortRef       = useRef<AbortController | null>(null)

  // ── Pull model with streaming progress ──────────────────────────────
  const pullModel = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, setupStatus: 'pulling', pullProgress: 0, pullLabel: 'Starting download…' }))
    abortRef.current = new AbortController()
    try {
      const res = await fetch(`${ollamaBaseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ model: VISION_MODEL, stream: true }),
      })
      if (!res.ok) throw new Error(`Pull failed: HTTP ${res.status}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line) as {
              status?: string; completed?: number; total?: number; error?: string
            }
            if (json.error) throw new Error(json.error)
            if (json.total && json.completed) {
              const pct = Math.round((json.completed / json.total) * 100)
              setState(prev => ({
                ...prev,
                pullProgress: pct,
                pullLabel: `Downloading vision model… ${pct}%`,
              }))
            } else if (json.status === 'success') {
              setState(prev => ({ ...prev, pullProgress: 100, pullLabel: 'Download complete!' }))
              return true
            } else if (json.status) {
              setState(prev => ({ ...prev, pullLabel: json.status! }))
            }
          } catch (e) { if ((e as Error).name !== 'SyntaxError') throw e }
        }
      }
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false
      setState(prev => ({ ...prev, setupStatus: 'error', error: (err as Error).message }))
      return false
    }
  }, [ollamaBaseUrl])

  // ── Screen analysis ─────────────────────────────────────────────────
  const analyze = useCallback(async () => {
    if (!window.electronAPI?.captureScreen || !visionModelRef.current) return
    setState(prev => ({ ...prev, isAnalyzing: true }))
    try {
      const dataUrl = await window.electronAPI.captureScreen()
      if (!dataUrl) { setState(prev => ({ ...prev, isAnalyzing: false })); return }
      const b64 = dataUrl.split(',')[1]
      const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: visionModelRef.current,
          prompt: 'In 2-4 words only, what is the main app or website visible on this screen? Examples: "YouTube video playing", "VS Code editor", "Gmail inbox", "Steam gaming". Answer only with the app or activity name.',
          images: [b64],
          stream: false,
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { response: string }
      const raw  = data.response?.trim() ?? ''
      const ctx  = classify(raw)
      setState(prev => ({ ...prev, isAnalyzing: false, rawLabel: raw, context: ctx }))
    } catch {
      setState(prev => ({ ...prev, isAnalyzing: false }))
    }
  }, [ollamaBaseUrl])

  const startMonitoring = useCallback((model: string) => {
    visionModelRef.current = model
    setState(prev => ({ ...prev, active: true, setupStatus: 'ready' }))
    analyze()
    intervalRef.current = setInterval(analyze, SCAN_INTERVAL)
  }, [analyze])

  // ── Public: setup + start ────────────────────────────────────────────
  const setupAndStart = useCallback(async () => {
    setState(prev => ({ ...prev, setupStatus: 'checking', error: null }))

    // 1. Check Ollama is running
    const existingModel = await findVisionModel(ollamaBaseUrl)
    if (existingModel === null) {
      // No response at all from Ollama
      try {
        await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) })
      } catch {
        setState(prev => ({ ...prev, setupStatus: 'no-ollama' }))
        return
      }
    }

    // 2. Use existing model or pull moondream
    if (existingModel) {
      startMonitoring(existingModel)
    } else {
      const ok = await pullModel()
      if (!ok) return
      const pulledModel = await findVisionModel(ollamaBaseUrl)
      if (!pulledModel) {
        setState(prev => ({ ...prev, setupStatus: 'error', error: 'Model pull succeeded but model not found.' }))
        return
      }
      startMonitoring(pulledModel)
    }
  }, [ollamaBaseUrl, pullModel, startMonitoring])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    visionModelRef.current = null
    prevContext.current = 'unknown'
    setState({
      active: false, setupStatus: 'idle', pullProgress: 0, pullLabel: '',
      context: 'unknown', rawLabel: '', isAnalyzing: false, error: null,
    })
  }, [])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const didContextChange = state.context !== 'unknown' && state.context !== prevContext.current
  if (didContextChange) prevContext.current = state.context

  return { state, setupAndStart, stop, didContextChange }
}

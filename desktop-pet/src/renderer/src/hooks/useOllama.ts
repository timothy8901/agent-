import { useState, useCallback, useRef } from 'react'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OllamaSettings {
  model: string
  baseUrl: string
  systemPrompt: string
}

const DEFAULT_SETTINGS: OllamaSettings = {
  model:        'qwen2.5:3b',
  baseUrl:      'http://localhost:11434',
  systemPrompt: `You are Igachi, a small but brilliant desktop companion who lives in the corner of the user's screen.
You help with any task: coding, writing, research, math, creative work, problem solving.
Be concise but thorough — use markdown for code (\`\`\`lang ... \`\`\`), bold key points with **text**, and lists where helpful.
You have a warm, slightly playful personality and genuinely care about helping the user.
Keep responses focused. For simple questions, be brief. For complex ones, be complete.`
}

function loadSettings(): OllamaSettings {
  try {
    const raw = localStorage.getItem('ollama-settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

function saveSettings(s: OllamaSettings) {
  localStorage.setItem('ollama-settings', JSON.stringify(s))
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem('chat-history')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveHistory(msgs: Message[]) {
  // Keep last 60 messages to avoid unbounded growth
  const trimmed = msgs.slice(-60)
  localStorage.setItem('chat-history', JSON.stringify(trimmed))
}

export function useOllama() {
  const [settings, setSettingsState] = useState<OllamaSettings>(loadSettings)
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [streaming, setStreaming] = useState(false)
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Check Ollama health + list models
  const checkOllama = useCallback(async (baseUrl = settings.baseUrl) => {
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json() as { models: { name: string }[] }
        setOllamaOnline(true)
        setAvailableModels(data.models?.map(m => m.name) ?? [])
        return true
      }
    } catch { /* ignore */ }
    setOllamaOnline(false)
    return false
  }, [settings.baseUrl])

  const updateSettings = useCallback((updates: Partial<OllamaSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      saveSettings(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    saveHistory([])
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // ── Main send function ───────────────────────────────────────────────────
  const send = useCallback(async (userText: string): Promise<void> => {
    if (streaming || !userText.trim()) return

    const userMsg: Message = { role: 'user', content: userText.trim() }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    saveHistory(nextHistory)
    setStreaming(true)

    // Placeholder assistant message that we'll stream into
    const placeholderIdx = nextHistory.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    try {
      const response = await fetch(`${settings.baseUrl}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body: JSON.stringify({
          model:    settings.model,
          messages: [
            { role: 'system', content: settings.systemPrompt },
            ...nextHistory.slice(-20)  // send last 20 turns for context
          ],
          stream: true,
          options: {
            temperature: 0.7,
            num_predict: 2048
          }
        })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Ollama error ${response.status}: ${err}`)
      }

      const reader   = response.body!.getReader()
      const decoder  = new TextDecoder()
      let   fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // NDJSON — one JSON object per line
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line) as {
              message?: { content: string }
              done: boolean
              error?: string
            }
            if (json.error) throw new Error(json.error)
            if (json.message?.content) {
              fullText += json.message.content
              setMessages(prev => {
                const updated = [...prev]
                updated[placeholderIdx] = { role: 'assistant', content: fullText }
                return updated
              })
            }
            if (json.done) break
          } catch (e) {
            if ((e as Error).name !== 'SyntaxError') throw e
          }
        }
      }

      // Persist complete assistant reply
      const finalHistory = [...nextHistory, { role: 'assistant' as const, content: fullText }]
      saveHistory(finalHistory)
    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError'
      if (!isAbort) {
        const errMsg = `⚠️ ${(err as Error).message}`
        setMessages(prev => {
          const updated = [...prev]
          updated[placeholderIdx] = { role: 'assistant', content: errMsg }
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }, [streaming, messages, settings])

  return {
    messages, streaming, ollamaOnline, availableModels,
    settings, updateSettings,
    send, stopGeneration, clearHistory, checkOllama
  }
}

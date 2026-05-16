import { useState, useCallback, useRef } from 'react'
import { TOOL_DEFS, TOOL_LABELS } from '../../../shared/tools'

export interface Message {
  role:        'user' | 'assistant' | 'system' | 'tool'
  content:     string
  // Tool-use bookkeeping (assistant + tool turns only)
  tool_calls?: OllamaToolCall[]
  tool_call_id?: string
  name?:       string  // tool name on tool messages
}

export interface OllamaSettings {
  model:        string
  baseUrl:      string
  systemPrompt: string
}

export interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

const DEFAULT_MODEL = 'qwen3:4b'

const DEFAULT_SETTINGS: OllamaSettings = {
  model:        DEFAULT_MODEL,
  baseUrl:      'http://localhost:11434',
  systemPrompt: `You are Patti, a friendly desktop companion who lives in the corner of the screen on macOS.
You help with everyday tasks: writing, answering questions, explaining things, and having a conversation.
Speak in plain, simple language — avoid jargon. Be warm, patient, and encouraging.
Keep answers short and easy to read. Use numbered steps when explaining how to do something.

You have access to local tools:
- list_calendar_events / create_calendar_event — read and write the user's macOS Calendar.
- set_reminder / list_reminders / cancel_reminder — schedule macOS notifications.
- find_files — search Spotlight in the user's home folder.

Use a tool whenever it gets a better answer than guessing. After a tool returns, summarize the result for the user in one or two sentences.`
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
  const trimmed = msgs.slice(-60)
  localStorage.setItem('chat-history', JSON.stringify(trimmed))
}

interface ChatChunk {
  message?: {
    content?:    string
    tool_calls?: OllamaToolCall[]
  }
  done:     boolean
  error?:   string
}

export function useOllama() {
  const [settings, setSettingsState] = useState<OllamaSettings>(loadSettings)
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [streaming, setStreaming] = useState(false)
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // ── One round-trip to /api/chat: streams tokens, captures any tool_calls ─
  async function chatRound(opts: {
    history:       Message[]
    onDelta:       (text: string) => void
    onAssistantToolCalls: (calls: OllamaToolCall[]) => void
    signal:        AbortSignal
  }): Promise<{ text: string; toolCalls: OllamaToolCall[] }> {
    const memory = localStorage.getItem('pet-memory') ?? ''
    const fullSystem = memory
      ? `${settings.systemPrompt}\n\n=== Personal Context ===\n${memory}`
      : settings.systemPrompt

    const response = await fetch(`${settings.baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  opts.signal,
      body: JSON.stringify({
        model:    settings.model,
        tools:    TOOL_DEFS,
        messages: [
          { role: 'system', content: fullSystem },
          ...opts.history.slice(-20),
        ],
        stream: true,
        options: { temperature: 0.7, num_predict: 2048 },
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Ollama error ${response.status}: ${err}`)
    }

    const reader   = response.body!.getReader()
    const decoder  = new TextDecoder()
    let   text     = ''
    let   toolCalls: OllamaToolCall[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line) as ChatChunk
          if (json.error) throw new Error(json.error)
          if (json.message?.content) {
            text += json.message.content
            opts.onDelta(text)
          }
          if (json.message?.tool_calls?.length) {
            toolCalls = toolCalls.concat(json.message.tool_calls)
          }
          if (json.done) break
        } catch (e) {
          if ((e as Error).name !== 'SyntaxError') throw e
        }
      }
    }

    if (toolCalls.length) opts.onAssistantToolCalls(toolCalls)
    return { text, toolCalls }
  }

  // ── Main send function with tool-calling loop ───────────────────────────
  const send = useCallback(async (userText: string): Promise<void> => {
    if (streaming || !userText.trim()) return

    const userMsg: Message = { role: 'user', content: userText.trim() }
    let history = [...messages, userMsg]
    setMessages(history)
    saveHistory(history)
    setStreaming(true)

    let placeholderIdx = history.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    try {
      // Up to 4 tool-use rounds before bailing out — protects against tool-loop runaways.
      for (let round = 0; round < 4; round++) {
        const { text, toolCalls } = await chatRound({
          history,
          onDelta: (t) => {
            setMessages(prev => {
              const upd = [...prev]
              upd[placeholderIdx] = { role: 'assistant', content: t }
              return upd
            })
          },
          onAssistantToolCalls: () => { /* status updated below */ },
          signal: abortRef.current!.signal,
        })

        const assistantMsg: Message = {
          role: 'assistant',
          content: text,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        }
        history = [...history, assistantMsg]
        setMessages(prev => {
          const upd = [...prev]
          upd[placeholderIdx] = assistantMsg
          return upd
        })
        saveHistory(history)

        if (!toolCalls.length) break

        // Execute each tool, append its result as a `tool` message, then loop.
        for (const call of toolCalls) {
          const name = call.function.name
          setActiveTool(TOOL_LABELS[name] ?? name)
          const result = await window.electronAPI.invokeTool({
            name,
            args: call.function.arguments ?? {},
          })
          const toolMsg: Message = {
            role:    'tool',
            name,
            content: JSON.stringify(result),
          }
          history = [...history, toolMsg]
          setMessages(prev => [...prev, toolMsg])
          saveHistory(history)
        }
        setActiveTool(null)

        // Add a fresh placeholder for the follow-up assistant turn.
        placeholderIdx = history.length
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      }
    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError'
      if (!isAbort) {
        const errMsg = `⚠️ ${(err as Error).message}`
        setMessages(prev => {
          const upd = [...prev]
          upd[placeholderIdx] = { role: 'assistant', content: errMsg }
          return upd
        })
      }
    } finally {
      setActiveTool(null)
      setStreaming(false)
    }
  }, [streaming, messages, settings])

  return {
    messages, streaming, ollamaOnline, availableModels, activeTool,
    settings, updateSettings,
    send, stopGeneration, clearHistory, checkOllama,
  }
}

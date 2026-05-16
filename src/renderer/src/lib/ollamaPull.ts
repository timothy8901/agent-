// Shared NDJSON-streaming model pull. Used by the first-run wizard,
// useScreenContext's vision-model bootstrap, and the LLM pull in useOllama.

export interface PullProgress {
  status: 'pulling' | 'success' | 'error'
  percent: number
  label:   string
  error?:  string
}

export interface PullOptions {
  baseUrl: string
  model:   string
  signal?: AbortSignal
  onProgress?: (p: PullProgress) => void
  // Cosmetic label prefix, e.g. "Downloading chat model"
  labelPrefix?: string
}

interface PullChunk {
  status?:    string
  completed?: number
  total?:     number
  error?:     string
}

export async function pullModel(opts: PullOptions): Promise<boolean> {
  const { baseUrl, model, signal, onProgress, labelPrefix = 'Downloading' } = opts
  onProgress?.({ status: 'pulling', percent: 0, label: 'Starting download…' })

  const res = await fetch(`${baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ model, stream: true }),
  })
  if (!res.ok) {
    const err = `Pull failed: HTTP ${res.status}`
    onProgress?.({ status: 'error', percent: 0, label: err, error: err })
    return false
  }

  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  let lastPct = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue
      let json: PullChunk
      try { json = JSON.parse(line) as PullChunk }
      catch { continue }

      if (json.error) {
        onProgress?.({ status: 'error', percent: lastPct, label: json.error, error: json.error })
        return false
      }
      if (json.total && json.completed) {
        const pct = Math.round((json.completed / json.total) * 100)
        lastPct = pct
        onProgress?.({
          status: 'pulling',
          percent: pct,
          label:   `${labelPrefix}… ${pct}%`,
        })
      } else if (json.status === 'success') {
        onProgress?.({ status: 'success', percent: 100, label: 'Download complete!' })
        return true
      } else if (json.status) {
        onProgress?.({ status: 'pulling', percent: lastPct, label: json.status })
      }
    }
  }
  onProgress?.({ status: 'success', percent: 100, label: 'Download complete!' })
  return true
}

export async function isOllamaAlive(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch { return false }
}

export async function listInstalledModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const data = await res.json() as { models?: { name: string }[] }
    return data.models?.map(m => m.name) ?? []
  } catch { return [] }
}

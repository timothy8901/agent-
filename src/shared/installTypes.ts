// Types shared between the Ollama installer (main) and the welcome wizard UI (renderer).

export type InstallPhase =
  | 'downloading'
  | 'mounting'
  | 'copying'
  | 'launching'
  | 'waiting'
  | 'done'
  | 'error'

export interface InstallProgress {
  phase:  InstallPhase
  label:  string
  error?: string
}

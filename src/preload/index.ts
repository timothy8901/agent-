import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ToolCallPayload, ToolResultPayload } from '../shared/tools'
import type { InstallProgress } from '../shared/installTypes'

contextBridge.exposeInMainWorld('electronAPI', {
  // Click-through toggle
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore),

  // Window expand/collapse
  setExpanded: (expand: boolean) =>
    ipcRenderer.send('set-expanded', expand),

  // Dragging
  dragStart: (pos: { mouseX: number; mouseY: number }) =>
    ipcRenderer.send('drag-start', pos),
  dragMove:  (pos: { mouseX: number; mouseY: number }) =>
    ipcRenderer.send('drag-move', pos),
  dragEnd: () =>
    ipcRenderer.send('drag-end'),

  // Context menu
  showContextMenu: () =>
    ipcRenderer.send('show-context-menu'),

  // Screen capture (returns data URL string or null)
  captureScreen: (): Promise<string | null> =>
    ipcRenderer.invoke('capture-screen'),

  // Agentic tools
  invokeTool: (call: ToolCallPayload): Promise<ToolResultPayload> =>
    ipcRenderer.invoke('invoke-tool', call),

  // Ollama install / status
  ollamaStatus: (): Promise<{ installed: boolean; running: boolean }> =>
    ipcRenderer.invoke('ollama-status'),
  installOllama: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('install-ollama'),
  onInstallProgress: (cb: (p: InstallProgress) => void) => {
    const handler = (_: IpcRendererEvent, p: InstallProgress) => cb(p)
    ipcRenderer.on('install-ollama-progress', handler)
    return () => ipcRenderer.removeListener('install-ollama-progress', handler)
  },
})

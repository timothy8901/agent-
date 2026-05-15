import { contextBridge, ipcRenderer } from 'electron'

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
})

import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, screen, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

import { dispatchTool, type ToolCallPayload } from './toolRouter'
import { initAlarms } from './tools/alarms'
import { installOllama, isDaemonReachable, isOllamaInstalled, type InstallProgress } from './installOllama'

// ── Window dimensions ──────────────────────────────────────────────────────
const COLLAPSED = { width: 215, height: 228 }
const EXPANDED  = { width: 440, height: 660 }

let win: BrowserWindow | null = null

// ── Persistent window position ─────────────────────────────────────────────
function statePath() {
  return join(app.getPath('userData'), 'window-state.json')
}
function loadPos(): { x?: number; y?: number } {
  try {
    if (existsSync(statePath())) return JSON.parse(readFileSync(statePath(), 'utf-8'))
  } catch { /* ignore */ }
  return {}
}
function savePos(x: number, y: number) {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(statePath(), JSON.stringify({ x, y }))
  } catch { /* ignore */ }
}

// ── Create overlay window ──────────────────────────────────────────────────
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const savedPos = loadPos()

  win = new BrowserWindow({
    width:  COLLAPSED.width,
    height: COLLAPSED.height,
    x: savedPos.x ?? sw - COLLAPSED.width  - 24,
    y: savedPos.y ?? sh - COLLAPSED.height - 24,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    // 'panel' on macOS floats above fullscreen apps
    type: 'panel',
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  })

  // Click-through transparent areas, but renderer still receives mousemove
  win.setIgnoreMouseEvents(true, { forward: true })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.on('set-ignore-mouse-events', (_e, ignore: boolean) => {
  win?.setIgnoreMouseEvents(ignore, { forward: true })
})

ipcMain.on('set-expanded', (_e, expand: boolean) => {
  if (!win) return
  const [x, y] = win.getPosition()
  const [w, h] = win.getSize()
  const next = expand ? EXPANDED : COLLAPSED
  const nx = x - (next.width  - w)
  const ny = y - (next.height - h)
  win.setSize(next.width, next.height)
  win.setPosition(nx, ny)
  savePos(nx, ny)
})

// Drag support – renderer sends screen-space mouse coords
let dragBase = { winX: 0, winY: 0, mouseX: 0, mouseY: 0 }

ipcMain.on('drag-start', (_e, pos: { mouseX: number; mouseY: number }) => {
  if (!win) return
  const [winX, winY] = win.getPosition()
  dragBase = { winX, winY, mouseX: pos.mouseX, mouseY: pos.mouseY }
})

ipcMain.on('drag-move', (_e, pos: { mouseX: number; mouseY: number }) => {
  if (!win) return
  win.setPosition(
    dragBase.winX + (pos.mouseX - dragBase.mouseX),
    dragBase.winY + (pos.mouseY - dragBase.mouseY)
  )
})

ipcMain.on('drag-end', () => {
  if (!win) return
  const [x, y] = win.getPosition()
  savePos(x, y)
})

// Screen capture — returns primary display thumbnail as data URL
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 640, height: 400 }
    })
    return sources[0]?.thumbnail.toDataURL() ?? null
  } catch { return null }
})

// Agentic tool dispatcher
ipcMain.handle('invoke-tool', async (_e, call: ToolCallPayload) => {
  return dispatchTool(call)
})

// Ollama auto-install / status
ipcMain.handle('ollama-status', async () => ({
  installed: isOllamaInstalled(),
  running:   await isDaemonReachable(),
}))

ipcMain.handle('install-ollama', async (event) => {
  try {
    await installOllama((p: InstallProgress) => {
      event.sender.send('install-ollama-progress', p)
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

// Context menu
ipcMain.on('show-context-menu', (event) => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Ollama docs',
      click: () => shell.openExternal('https://ollama.com')
    },
    { type: 'separator' },
    {
      label: 'Quit Desktop Pet Patti',
      click: () => app.quit()
    }
  ])
  const webContents = event.sender
  const bw = BrowserWindow.fromWebContents(webContents)
  if (bw) menu.popup({ window: bw })
})

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initAlarms()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Mac-only app — keep running even when last window closes (system tray-style)
app.on('window-all-closed', () => {
  // Intentionally a no-op on macOS so Patti stays alive in the dock.
})

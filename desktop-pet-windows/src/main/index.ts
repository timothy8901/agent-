import {
  app, BrowserWindow, desktopCapturer, ipcMain,
  Menu, screen, shell, Tray, nativeImage
} from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

// ── Window dimensions ──────────────────────────────────────────────────────
const COLLAPSED = { width: 215, height: 228 }
const EXPANDED  = { width: 440, height: 660 }

let win:  BrowserWindow | null = null
let tray: Tray | null = null

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

// ── Tray icon (works in dev and packaged) ──────────────────────────────────
function trayIconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'icon.png')
  return join(app.getAppPath(), 'build', 'icon.png')
}

// ── System tray ────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Patti Desktop Pet')

  function buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: win?.isVisible() ? 'Hide Patti' : 'Show Patti',
        click: () => { if (win?.isVisible()) win.hide(); else win?.show() }
      },
      { type: 'separator' },
      {
        label: 'Open Ollama docs',
        click: () => shell.openExternal('https://ollama.com')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          win?.removeAllListeners('close')
          app.quit()
        }
      }
    ])
  }

  tray.on('click', () => {
    if (win?.isVisible()) win.hide(); else win?.show()
  })
  tray.on('right-click', () => {
    tray?.setContextMenu(buildMenu())
    tray?.popUpContextMenu()
  })
  tray.setContextMenu(buildMenu())
}

// ── Create overlay window ──────────────────────────────────────────────────
function createWindow() {
  // Use workArea so the default position respects the Windows taskbar
  const { x: wx, y: wy, width: ww, height: wh } = screen.getPrimaryDisplay().workArea
  const savedPos = loadPos()

  win = new BrowserWindow({
    width:  COLLAPSED.width,
    height: COLLAPSED.height,
    x: savedPos.x ?? wx + ww - COLLAPSED.width  - 24,
    y: savedPos.y ?? wy + wh - COLLAPSED.height - 24,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  })

  // 'screen-saver' level keeps the pet above more Windows surfaces than default
  win.setAlwaysOnTop(true, 'screen-saver')

  // Click-through transparent areas; renderer still receives mousemove
  win.setIgnoreMouseEvents(true, { forward: true })

  // Hide to tray instead of destroying — user restores via tray icon
  win.on('close', (e) => {
    e.preventDefault()
    win?.hide()
  })

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

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 640, height: 400 }
    })
    return sources[0]?.thumbnail.toDataURL() ?? null
  } catch { return null }
})

ipcMain.on('show-context-menu', (event) => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Ollama docs',
      click: () => shell.openExternal('https://ollama.com')
    },
    { type: 'separator' },
    {
      label: 'Quit Patti',
      click: () => {
        win?.removeAllListeners('close')
        app.quit()
      }
    }
  ])
  const bw = BrowserWindow.fromWebContents(event.sender)
  if (bw) menu.popup({ window: bw })
})

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()
})

// The close handler above prevents the window from actually closing, so
// window-all-closed only fires on an explicit app.quit() call.
app.on('window-all-closed', () => app.quit())

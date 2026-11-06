import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  safeStorage,
  globalShortcut,
} from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { handleSkill } from './skills'

const BUDDY_WIDTH = 280
const BUDDY_HEIGHT = 320
const PANEL_WIDTH = 400
const PANEL_HEIGHT = 540

const userData = app.getPath('userData')
const memoryPath = join(userData, 'memory.json')
const windowStatePath = join(userData, 'window-state.json')
const settingsPath = join(userData, 'settings.json')
const apiKeyPath = join(userData, 'api-key.bin')

let buddyWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null
let tray: Tray | null = null
let savePositionTimer: NodeJS.Timeout | null = null

type Memory = {
  name: string
  preferences: Record<string, unknown>
  moodHistory: Array<{ mood: string; timestamp: number }>
  notes: Array<{ text: string; timestamp: number }>
  projects: string[]
  lastSeen: number | null
}

const emptyMemory = (): Memory => ({
  name: '',
  preferences: {},
  moodHistory: [],
  notes: [],
  projects: [],
  lastSeen: null,
})

function readJson<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch (error) {
    console.error(`Could not read ${path}`, error)
  }
  return fallback
}

function writeJson(path: string, value: unknown): void {
  try {
    writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
  } catch (error) {
    console.error(`Could not write ${path}`, error)
  }
}

let memory: Memory = readJson<Memory>(memoryPath, emptyMemory())

type Settings = {
  hotkey: string
  wakeWord: string
  theme: 'light' | 'dark'
  startup: boolean
}

const defaultSettings: Settings = {
  hotkey: 'CommandOrControl+Space',
  wakeWord: 'Hey momo',
  theme: 'dark',
  startup: false,
}

let settings: Settings = { ...defaultSettings, ...readJson<Partial<Settings>>(settingsPath, {}) }
const saveSettings = () => writeJson(settingsPath, settings)

/** Electron wants "Control", not "Ctrl". */
const normalizeHotkey = (value: string) => value.replace(/^Ctrl\+/i, 'Control+')

function registerHotkey(accelerator: string): boolean {
  globalShortcut.unregisterAll()
  const normalized = normalizeHotkey(accelerator)
  try {
    return globalShortcut.register(normalized, () => {
      buddyWindow?.show()
      buddyWindow?.webContents.send('ptt:toggle')
    })
  } catch (error) {
    console.error('Could not register hotkey', accelerator, error)
    return false
  }
}

/** Load the last known window position, clamped to a visible display. */
function loadWindowPosition(): { x: number; y: number } {
  const saved = readJson<{ x?: number; y?: number }>(windowStatePath, {})
  const display = screen.getPrimaryDisplay()
  const area = display.workArea

  const fallback = {
    x: Math.round(area.x + area.width - BUDDY_WIDTH - 40),
    y: Math.round(area.y + area.height - BUDDY_HEIGHT - 80),
  }

  if (typeof saved.x !== 'number' || typeof saved.y !== 'number') return fallback

  // Make sure a previously saved position is still on an attached monitor.
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return saved.x! >= a.x - BUDDY_WIDTH && saved.x! <= a.x + a.width && saved.y! >= a.y - BUDDY_HEIGHT && saved.y! <= a.y + a.height
  })
  return visible ? { x: saved.x, y: saved.y } : fallback
}

function persistWindowPosition(): void {
  if (!buddyWindow) return
  if (savePositionTimer) clearTimeout(savePositionTimer)
  savePositionTimer = setTimeout(() => {
    if (!buddyWindow) return
    const [x, y] = buddyWindow.getPosition()
    writeJson(windowStatePath, { x, y })
  }, 300)
}

function rendererUrl(view: 'buddy' | 'panel'): { url?: string; file?: string; query: Record<string, string> } {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const separator = devUrl.includes('?') ? '&' : '?'
    return { url: `${devUrl}${separator}view=${view}`, query: { view } }
  }
  return { file: join(__dirname, '../renderer/index.html'), query: { view } }
}

function loadRenderer(win: BrowserWindow, view: 'buddy' | 'panel'): void {
  const target = rendererUrl(view)
  if (target.url) {
    win.loadURL(target.url)
  } else {
    win.loadFile(target.file!, { query: target.query })
  }
}

function createBuddyWindow(): void {
  const { x, y } = loadWindowPosition()

  buddyWindow = new BrowserWindow({
    width: BUDDY_WIDTH,
    height: BUDDY_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Keep it above normal windows without stealing focus.
  buddyWindow.setAlwaysOnTop(true, 'screen-saver')
  buddyWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  buddyWindow.once('ready-to-show', () => buddyWindow?.show())
  buddyWindow.on('moved', persistWindowPosition)
  buddyWindow.on('closed', () => {
    buddyWindow = null
  })

  loadRenderer(buddyWindow, 'buddy')
}

function createPanelWindow(): BrowserWindow {
  if (panelWindow && !panelWindow.isDestroyed()) return panelWindow

  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  panelWindow.on('closed', () => {
    panelWindow = null
  })

  loadRenderer(panelWindow, 'panel')
  return panelWindow
}

/** Place the panel beside Buddy, keeping it on-screen. */
function positionPanel(): void {
  if (!buddyWindow || !panelWindow) return
  const [bx, by] = buddyWindow.getPosition()
  const display = screen.getDisplayNearestPoint({ x: bx, y: by })
  const area = display.workArea

  let x = bx + BUDDY_WIDTH + 8
  if (x + PANEL_WIDTH > area.x + area.width) {
    x = bx - PANEL_WIDTH - 8
  }
  const y = Math.min(Math.max(by + BUDDY_HEIGHT - PANEL_HEIGHT, area.y + 8), area.y + area.height - PANEL_HEIGHT - 8)

  panelWindow.setPosition(Math.round(x), Math.round(y), false)
}

function openPanel(): void {
  const win = createPanelWindow()
  positionPanel()
  win.show()
  win.focus()
}

function closePanel(): void {
  panelWindow?.hide()
}

function createTrayIcon(): Electron.NativeImage {
  // Build a tiny 16x16 rounded "blob" icon in BGRA, so we don't ship a binary asset.
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const radius = 6.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - center, y - center)
      if (dist <= radius) {
        const i = (y * size + x) * 4
        // Slight edge anti-aliasing
        const alpha = dist > radius - 1 ? Math.round(255 * (radius - dist)) : 255
        buffer[i] = 200 // B
        buffer[i + 1] = 140 // G
        buffer[i + 2] = 255 // R
        buffer[i + 3] = Math.max(0, Math.min(255, alpha)) // A
      }
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size })
}

function createTray(): void {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('momo - your desktop companion')

  const rebuild = () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Show Buddy', click: () => buddyWindow?.show() },
      { label: 'Hide Buddy', click: () => buddyWindow?.hide() },
      { type: 'separator' },
      { label: 'Open Panel', click: () => openPanel() },
      {
        label: 'Mute microphone',
        type: 'checkbox',
        checked: false,
        click: (item) => buddyWindow?.webContents.send('mic-muted', item.checked),
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
    tray?.setContextMenu(menu)
  }

  rebuild()
  tray.on('click', () => {
    if (buddyWindow?.isVisible()) {
      buddyWindow.hide()
    } else {
      buddyWindow?.show()
    }
  })
}

/* ------------------------------ IPC ------------------------------ */

ipcMain.handle('memory:load', () => memory)
ipcMain.handle('memory:save', (_event, next: Memory) => {
  memory = next
  writeJson(memoryPath, memory)
  return true
})
ipcMain.handle('memory:clear', () => {
  memory = emptyMemory()
  writeJson(memoryPath, memory)
  return memory
})

ipcMain.handle('api-key:save', (_event, key: string) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(apiKeyPath, safeStorage.encryptString(key))
    } else {
      // Fall back with a clear warning; local disk only.
      writeFileSync(apiKeyPath, key, 'utf-8')
    }
    return true
  } catch (error) {
    console.error('Failed to save API key', error)
    return false
  }
})

ipcMain.handle('api-key:get', () => {
  try {
    if (!existsSync(apiKeyPath)) return null
    const raw = readFileSync(apiKeyPath)
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(raw)
      } catch {
        return raw.toString('utf-8')
      }
    }
    return raw.toString('utf-8')
  } catch (error) {
    console.error('Failed to read API key', error)
    return null
  }
})

ipcMain.handle('window:set-position', (_event, x: number, y: number) => {
  buddyWindow?.setPosition(Math.round(x), Math.round(y), false)
  return true
})

ipcMain.handle('window:get-position', () => {
  if (!buddyWindow) return { x: 0, y: 0 }
  const [x, y] = buddyWindow.getPosition()
  return { x, y }
})

ipcMain.handle('panel:open', () => {
  openPanel()
  return true
})
ipcMain.handle('panel:close', () => {
  closePanel()
  return true
})

ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark') => {
  panelWindow?.webContents.send('theme:changed', theme)
  return true
})

ipcMain.handle('settings:wake-word', (_event, word: string) => {
  settings.wakeWord = word
  saveSettings()
  buddyWindow?.webContents.send('settings:wake-word', word)
  return true
})
ipcMain.handle('settings:hotkey', (_event, hotkey: string) => {
  settings.hotkey = hotkey
  saveSettings()
  registerHotkey(hotkey)
  buddyWindow?.webContents.send('settings:hotkey', hotkey)
  return true
})

ipcMain.handle('startup:set', (_event, enabled: boolean) => {
  settings.startup = enabled
  saveSettings()
  app.setLoginItemSettings({ openAtLogin: enabled })
  return true
})

ipcMain.handle('skill:run', async (_event, skill: string, payload: unknown) => {
  return handleSkill(skill, payload, { memory, saveMemory: (next) => { memory = next; writeJson(memoryPath, memory) } })
})

ipcMain.handle('app:quit', () => {
  app.quit()
})

/* ---------------------------- lifecycle --------------------------- */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    buddyWindow?.show()
    buddyWindow?.focus()
  })

  app.whenReady().then(() => {
    createBuddyWindow()
    createTray()

    if (!registerHotkey(settings.hotkey)) {
      console.warn(`Hotkey "${settings.hotkey}" is unavailable; pick another in settings.`)
    }

    app.on('activate', () => {
      if (!buddyWindow) createBuddyWindow()
      else buddyWindow.show()
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

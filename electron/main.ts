import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const IS_DEV = process.env.NODE_ENV === 'development'

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Memory file path
const memoryPath = path.join(app.getPath('userData'), 'memory.json')

// Load persisted memory
function loadMemory(): any {
  try {
    if (fs.existsSync(memoryPath)) {
      const data = fs.readFileSync(memoryPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load memory', error)
  }
  return { name: '', preferences: {}, moodHistory: [], projects: [] }
}

// Save memory to disk
function saveMemory(memory: any): void {
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save memory', error)
  }
}

// Initialize memory
let userMemory = loadMemory()

// Create the main window
function createWindow() {
  // Window dimensions - small and unobtrusive
  const width = 200
  const height = 200

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 100,
    y: 100,
    frame: false, // frameless
    alwaysOnTop: true,
    transparent: true, // critical for transparency
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(err => {
    console.error('Failed to load app', err)
  })

  // Emitted when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null
    if (tray) tray.destroy()
  })

  // Handle resize to keep character centered or at saved position
  mainWindow.on('resize', () => {
    mainWindow?.setBounds({
      ...mainWindow.getBounds(),
      width: Math.max(mainWindow.getBounds().width, 200),
      height: Math.max(mainWindow.getBounds().height, 200),
    })
  })
}

// Handle IPC messages from renderer
ipcMain.handle('load-memory', () => userMemory)
ipcMain.handle('save-memory', (_, memory: any) => {
  userMemory = memory
  saveMemory(memory)
  return true
})

ipcMain.handle('set-window-bounds', (_, bounds: { x: number; y: number; width: number; height: number }) => {
  if (mainWindow) {
    mainWindow.setBounds(bounds)
  }
  return true
})

ipcMain.handle('set-character-position', (_, x: number, y: number) => {
  if (mainWindow) {
    const { width, height } = mainWindow.getBounds()
    mainWindow.setBounds({
      ...mainWindow.getBounds(),
      x: x - width / 2,
      y: y - height / 2,
    })
  }
  return true
})

ipcMain.handle('set-character-state', (_, state: string) => {
  // Forward to renderer to animate character
  mainWindow?.webContents.send('character-state-changed', state)
  return true
})

ipcMain.handle('execute-skill', async (_, { skill, data }: { skill: string; data: any }) => {
  // Route to skill handlers
  const result = await handleSkill(skill, data)
  if (mainWindow) {
    mainWindow.webContents.send('skill-result', { skill, result })
  }
  return result
})

ipcMain.handle('set-theme', (_, theme: 'light' | 'dark') => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', theme)
  }
  return true
})

ipcMain.handle('save-api-key', (_, key: string) => {
  const keyPath = path.join(app.getPath('userData'), 'api-key.bin')
  try {
    fs.writeFileSync(keyPath, key, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save API key', error)
    return false
  }
})

ipcMain.handle('get-api-key', () => {
  const keyPath = path.join(app.getPath('userData'), 'api-key.bin')
  try {
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf-8')
    }
    return null
  } catch (error) {
    console.error('Failed to get API key', error)
    return null
  }
})

ipcMain.handle('start-listening', () => {
  mainWindow?.webContents.send('listening-status', true)
  return true
})

ipcMain.handle('stop-listening', () => {
  mainWindow?.webContents.send('listening-status', false)
  return true
})

ipcMain.handle('set-wake-word', (_, word: string) => {
  mainWindow?.webContents.send('wake-word-set', word)
  return true
})

ipcMain.handle('set-hotkey', (_, hotkey: string) => {
  mainWindow?.webContents.send('hotkey-set', hotkey)
  return true
})

// Create tray icon
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png')
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Buddy', click: () => mainWindow?.show() },
    { label: 'Mute Mic', click: () => mainWindow?.webContents.send('toggle-mic') },
    { label: 'Settings', click: () => mainWindow?.webContents.send('open-settings') },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setToolTip('Buddy - Your AI Companion')
  tray.setContextMenu(contextMenu)

  // Double-click to show/hide
  tray.on('double-click', () => {
    mainWindow?.show()
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
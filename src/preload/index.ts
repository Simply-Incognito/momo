import { contextBridge, ipcRenderer } from 'electron'

/**
 * The only bridge between the sandboxed UI and the main process.
 * Keep this surface small and explicit.
 */
const buddy = {
  // Memory
  loadMemory: () => ipcRenderer.invoke('memory:load'),
  saveMemory: (memory: unknown) => ipcRenderer.invoke('memory:save', memory),
  clearMemory: () => ipcRenderer.invoke('memory:clear'),

  // API key (stored encrypted via Electron safeStorage when available)
  saveApiKey: (key: string) => ipcRenderer.invoke('api-key:save', key),
  getApiKey: () => ipcRenderer.invoke('api-key:get'),

  // Window positioning (used for dragging the character)
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('window:set-position', x, y),
  getWindowPosition: () => ipcRenderer.invoke('window:get-position'),

  // Panel window
  openPanel: () => ipcRenderer.invoke('panel:open'),
  closePanel: () => ipcRenderer.invoke('panel:close'),

  // Settings
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
  setWakeWord: (word: string) => ipcRenderer.invoke('settings:wake-word', word),
  setHotkey: (hotkey: string) => ipcRenderer.invoke('settings:hotkey', hotkey),
  setStartup: (enabled: boolean) => ipcRenderer.invoke('startup:set', enabled),

  // Skills
  runSkill: (skill: string, payload?: unknown) => ipcRenderer.invoke('skill:run', skill, payload),

  // Speech-to-text (local Whisper in the main process)
  transcribe: (audio: Float32Array) => ipcRenderer.invoke('voice:transcribe', audio),

  // Misc
  quit: () => ipcRenderer.invoke('app:quit'),

  /** Subscribe to a main-process event. Returns an unsubscribe function. */
  on: (channel: string, listener: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
}

contextBridge.exposeInMainWorld('buddy', buddy)

export type BuddyApi = typeof buddy

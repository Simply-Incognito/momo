// Preload script that runs in the renderer context before DOM loads
// Expose protected Electron APIs to the renderer process

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI, {
  // Window control
  setWindowBounds: (bounds: { x: number; y: number; width: number; height: number }) => 
    ipcRenderer.invoke('set-window-bounds', bounds),
  
  // Memory
  saveMemory: (memory: any) => ipcRenderer.invoke('save-memory', memory),
  loadMemory: () => ipcRenderer.invoke('load-memory'),
  
  // Skills
  executeSkill: (skill: string, data: any) => 
    ipcRenderer.invoke('execute-skill', skill, data),
  
  // Voice
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening),
  setWakeWord: (word: string) => ipcRenderer.invoke('set-wake-word', word),
  setHotkey: (hotkey: string) => ipcRenderer.invoke('set-hotkey', hotkey),
  
  // API key
  saveApiKey: (key: string) => ipcRenderer.invoke('save-api-key', key),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  
  // Theme
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('set-theme', theme),
  
  // Character
  setCharacterState: (state: string) => ipcRenderer.invoke('set-character-state', state),
  setCharacterPosition: (x: number, y: number) => 
    ipcRenderer.invoke('set-character-position', x, y),
})
// Preload script that runs in the renderer context before DOM loads
// Exposes protected Electron APIs to the renderer process contextually

const { contextBridge, ipcRenderer } = require('electron')

// Expose APIs only when DOM is ready
contextBridge.exposeInMainWorld('electronAPI, {
  // Window control
  setWindowBounds: (bounds) => 
    ipcRenderer.invoke('set-window-bounds', bounds),
  
  // Memory
  saveMemory: (memory) => ipcRenderer.invoke('save-memory', memory),
  loadMemory: () => ipcRenderer.invoke('load-memory'),
  
  // Skills
  executeSkill: (skill, data) => ipcRenderer.invoke('execute-skill', skill, data),
  
  // Voice
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  setWakeWord: (word) => ipcRenderer.invoke('set-wake-word', word),
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),
  
  // API key
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  
  // Theme
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // Character
  setCharacterState: (state) => ipcRenderer.invoke('set-character-state', state),
  setCharacterPosition: (x, y) => ipcRenderer.invoke('set-character-position', x, y),
})
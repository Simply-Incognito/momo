import React, { useEffect, useState } from 'react'
import { useMemory } from '../hooks/useMemory'
import { useSpeech } from '../hooks/useSpeech'
import CharacterCanvas from './CharacterCanvas'
import SpeechBubble from './SpeechBubble'

type AppProps = {
  electronAPI: any
  onStateChange?: (state: string) => void
}

export const App: React.FC<AppProps> = ({
  electronAPI,
  onStateChange
}) => {
  const { memory, setName, setPreference, addMood, getPreference } = useMemory()
  const {
    isListening,
    transcript,
    caption,
    isSpeaking,
    speak,
    stopListening,
    startListening,
    wakeWord,
    hotkey,
  } = useSpeech()

  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'talking'>('idle')
  const [bubbleText, setBubbleText] = useState('')
  const [captionText, setCaptionText] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [accentColor, setAccentColor] = useState('#FF6B6B')
  const [minimized, setMinimized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Update document title based on memory
  useEffect(() => {
    const title = memory.name ? `Buddy - ${memory.name}` : 'Buddy'
    document.title = title
  }, [memory.name])

  // Sync theme from settings
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // Handle character state changes
  useEffect(() => {
    setState((prev) => {
      const stateMap: Record<'idle' | 'listening' | 'thinking' | 'talking', 'idle' | 'listening' | 'thinking' | 'talking'> = {
        idle: 'idle',
        listening: 'listening',
        thinking: 'thinking',
        talking: 'talking',
      }
      return stateMap[prev] || 'idle'
    })
    onStateChange?.(state)
  }, [state])

  // Handle speech recognition updates
  useEffect(() => {
    // Update caption with live transcription
    setCaptionText(caption)
  }, [caption])

  // Handle speak completion
  useEffect(() => {
    if (!isSpeaking) {
      setState('idle')
      setBubbleText('')
    }
  }, [isSpeaking])

  // Handle wake word detection
  useEffect(() => {
    // This would be handled by the preload/ipc, but we track it here
    // If user says "Hey Buddy", start listening
  }, [wakeWord])

  // Set character state based on app state
  useEffect(() => {
    switch (state) {
      case 'idle':
        setState('idle')
        break
      case 'listening':
        setState('listening')
        break
      case 'thinking':
        setState('thinking')
        break
      case 'talking':
        setState('talking')
        break
    }
  }, [state])

  // Set character state via electron
  useEffect(() => {
    const setCharacterState = (s: string) => {
      electronAPI?.setCharacterState?.(s)
    }
    setCharacterState(state)
    return () => {
      setCharacterState('idle')
    }
  }, [state, electronAPI])

  // Handle minimize to tray
  useEffect(() => {
    // Window control would be handled by electron IPC
  }, [])

  // Auto-save memory on mood changes
  useEffect(() => {
    if (memory.name || memory.lastSeen) {
      // Memory is persisted via the useMemory hook's localStorage effect
    }
  }, [memory])

  // Open/close settings panel
  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen)
  }

  // Handle skill execution
  const handleSkill = (skill: string, data: any) => {
    // Route skills through electron
    electronAPI?.executeSkill?.(skill, data)
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Character container - the floating buddy */}
      <div 
        className="character-container"
        role="dialog"
        aria-label="Buddy the AI companion"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setSettingsOpen(false)
          }
        }}
      >
        {/* Character canvas - rendered by PixiJS */}
        <div id="character-canvas" style={{ width: '100%', height: '100%' }}>
          {/* Fallback: if canvas fails to load */}
          <span 
            style={{
              position: 'absolute',
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FFD1E8', color: '#FF6B6B',
              fontSize: '48px', pointerEvents: 'none',
            }}
          >
            👋
          </span>
        </div>

        {/* Speech bubble - follows character position */}
        <SpeechBubble
          visible={!!bubbleText}
          text={bubbleText}
          caption={captionText}
          theme={theme}
          accentColor={accentColor}
        />
      </div>

      {/* Bottom speech bubble - always visible when talking */}
      <div 
        className="bubble-container"
        style={{ bottom: minimized ? '80px' : '20px' }}
      >
        <span 
          onClick={() => setMinimized(!minimized)}
          style={{
            cursor: 'pointer',
            fontSize: '11px',
            color: '#7F8C8D',
            marginBottom: '4px',
            display: 'block',
          }}
        >
          Click to chat · Hotkey: {hotkey}
        </span>
        <div 
          className={`speech-bubble ${isListening ? 'accent-primary' : ''}`}
          style={{
            opacity: isListening ? 1 : 0.5,
            background: theme === 'dark' ? 'rgba(44, 62, 80, 0.9)' : 'rgba(255,255,255,0.9)',
          }}
        >
          {isListening 
            ? `Listening... ${captionText || ''}` 
            : bubbleText || 'Say Hey Buddy to start'}
        </div>
      </div>

      {/* Settings panel - appears on right side when open */}
      {settingsOpen && (
        <div 
          className="settings-panel"
          style={{
            right: 20,
            top: 20,
            transform: 'translateX(20px)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <button 
            className="theme-toggle"
            onClick={() => {
              setTheme(prev => prev === 'light' ? 'dark' : 'light')
              toggleSettings()
            }}
          >
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            Theme
          </button>
          
          <h3 style={{ margin: '16px 0 12px', fontSize: '13px' }}>Voice Settings</h3>
          
          <input 
            className="settings-input"
            type="text"
            placeholder="Wake word (e.g., 'Hey Buddy')"
            value={wakeWord}
            onChange={(e) => electronAPI?.setWakeWord?.(e.target.value)}
            disabled={isListening}
          />
          <span className="hotkey-display">Hotkey: {hotkey}</span>
          
          <button className="settings-button" onClick={() => startListening()} disabled={isListening}>
            Start Listening
          </button>
          <button className="settings-button" onClick={() => stopListening()} disabled={!isListening}>
            Stop
          </button>
          
          <h3 style={{ margin: '24px 0 12px', fontSize: '13px' }}>Personality</h3>
          
          <button className="settings-button" style={{ background: '#7FB3D5', marginBottom: '8px' }}>
            Playful
          </button>
          <button className="settings-button" style={{ background: '#D5C77F', marginBottom: '8px' }}>
            Serious
          </button>
          
          <h3 style={{ margin: '24px 0 12px', fontSize: '13px' }}>Memory</h3>
          
          <input 
            className="settings-input"
            type="text"
            placeholder="Your name"
            value={memory.name || ''}
            onChange={(e) => setName(e.target.value)}
            disabled={isListening}
            readOnly={true}
            style={{ marginBottom: '8px' }}
          />
          <p style={{ fontSize: '12px', color: '#7F8C8D', marginBottom: '12px' }}>
            Memory stored locally
          </p>
          
          <button className="settings-button" style={{ background: '#FF6B6B', width: '100%', marginTop: '8px' }}>
            View Full Memory
          </button>
          
          <button className="settings-button" onClick={() => toggleSettings()} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: '1px solid var(--muted-light)' }}>
            Close
          </button>
        </div>
      )}

      {/* Status indicator (when screen awareness is active) */}
      {/* <div className="status-indicator" title="Screen awareness active" /> */}
    </div>
  )
}

export default App
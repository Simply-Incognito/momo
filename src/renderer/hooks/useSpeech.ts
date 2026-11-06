// useSpeech.ts
// Custom hook for handling speech recognition and synthesis
// Provides abstraction for Web Speech API with future Whisper/ElevenLabs support

import { useState, useEffect, useRef } from 'react'

type SpeechRecognitionResult = {
  transcript: string
  isFinal: boolean
}

type SpeechRecognitionStartOptions = {
  language?: string
  continuous?: boolean
  interimResults?: boolean
}

type TtsOptions = {
  rate?: number
  pitch?: number
  volume?: number
  voice?: SpeechSynthesisVoice
}

export class SpeechService {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private wakeWord = 'Hey Buddy'
  private hotkey = 'Ctrl+Space'
  private utteranceQueue: SpeechSynthesisUtterance[] = []
  private isSpeaking = false

  constructor() {
    this.initRecognition()
  }

  private initRecognition() {
    // Check if Web Speech API is available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const RecognitionClass = ('webkitSpeechRecognition' in window) 
        ? window.SpeechRecognition 
        : window.webkitSpeechRecognition
      
      this.recognition = new RecognitionClass()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'en-US'

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((res: SpeechRecognitionResult) => res[0].transcript)
          .join('')

        const interimTranscript = Array.from(event.results)
          .map((res: SpeechRecognitionResult) => res[0].transcript)
          .filter((t: string) => event.results[0][0].isFinal === false)
          .join('')

        this.onSpeechUpdate(transcript, interimTranscript)
      }

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error)
        this.isListening = false
      }

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart recognition if still listening
          try { this.recognition!.start() } catch (e) {}
        }
      }
    }
  }

  private onSpeechUpdate(finalTranscript: string, interimTranscript: string) {
    // Could emit to parent component or update state
    // For now, just log
    // console.log('Final:', finalTranscript, 'Interim:', interimTranscript)
  }

  startListening(wakeWord?: string, hotkey?: string): void {
    if (!this.recognition) return
    
    this.wakeWord = wakeWord || this.wakeWord
    this.hotkey = hotkey || this.hotkey
    this.isListening = true
    
    try {
      this.recognition.start()
    } catch (e) {
      console.error('Failed to start speech recognition', e)
      this.isListening = false
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.isListening = false
      try {
        this.recognition.stop()
      } catch (e) {}
    }
  }

  // Text-to-Speech
  speak(text: string, options: TtsOptions = {}): void {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not available')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Default settings
    utterance.rate = options.rate || 1.0
    utterance.pitch = options.pitch || 1.0
    utterance.volume = options.volume || 0.8
    
    // Try to find a pleasant voice
    const voices = window.speechSynthesis.getVoices()
    const defaultVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha')) || voices[0]
    utterance.voice = defaultVoice || options.voice

    // Queue the utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    
    this.isSpeaking = true
    utterance.onend = () => { this.isSpeaking = false }
    utterance.onerror = (e) => { 
      console.error('TTS error', e) 
      this.isSpeaking = false 
    }
  }

  // Wake word detection
  checkWakeWord(transcript: string): boolean {
    const lower = transcript.toLowerCase().trim()
    return lower.includes(this.wakeWord.toLowerCase())
  }

  // Hotkey detection
  checkHotkey(event: KeyboardEvent): boolean {
    const keys = this.hotkey.toLowerCase().split('+')
    const ctrl = keys.includes('ctrl') || keys.includes('control')
    const space = keys.includes('space')
    
    if (ctrl && space) {
      return event.ctrlKey && event.key === ' '
    }
    
    return false
  }

  get isListeningState(): boolean {
    return this.isListening
  }

  getWakeWord(): string {
    return this.wakeWord
  }

  getHotkey(): string {
    return this.hotkey
  }
}

// Hook for using speech service
export function useSpeech() {
  const service = new SpeechService()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [caption, setCaption] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    const handleResult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join('')

      const interimTranscript = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .filter((t: any) => event.results[0][0].isFinal === false)
        .join('')

      setTranscript(interimTranscript)
      
      if (event.results[0][0].isFinal) {
        setCaption(prev => {
          const newCaption = transcript.trim()
          return newCaption || prev
        })
        
        // Check for wake word
        if (service.checkWakeWord(transcript)) {
          // Wake word detected - start conversation
          setIsListening(false)
          setTranscript('')
        }
      }
    }

    // Keyboard event for hotkey
    const handleKeyDown = (event: KeyboardEvent) => {
      if (service.checkHotkey(event)) {
        event.preventDefault()
        if (isListening) {
          service.stopListening()
          setIsListening(false)
        } else {
          service.startListening()
          setIsListening(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening, service])

  return {
    isListening,
    transcript,
    caption,
    isSpeaking,
    startListening: () => { service.startListening(); setIsListening(true) },
    stopListening: () => { service.stopListening(); setIsListening(false) },
    speak: (text: string) => { service.speak(text); setIsSpeaking(true) },
    wakeWord: service.getWakeWord(),
    hotkey: service.getHotkey(),
  }
}

export default SpeechService
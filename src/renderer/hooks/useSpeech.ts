import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Speech I/O abstraction.
 *
 * Today it uses the browser SpeechRecognition / speechSynthesis APIs. The
 * surface is intentionally small so a Whisper (STT) or ElevenLabs (TTS)
 * provider can be dropped in later without touching the UI.
 */

type Options = {
  onFinal?: (text: string) => void
  onError?: (reason: string) => void
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export function useSpeech({ onFinal, onError }: Options = {}) {
  const [listening, setListening] = useState(false)
  const [caption, setCaption] = useState('')
  const [supported, setSupported] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)
  const onErrorRef = useRef(onError)
  onFinalRef.current = onFinal
  onErrorRef.current = onError

  useEffect(() => {
    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return

    const rec: SpeechRecognitionLike = new Ctor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      let finalText = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interim += result[0].transcript
      }
      if (interim) setCaption(interim.trim())
      if (finalText) {
        const text = finalText.trim()
        setCaption(text)
        onFinalRef.current?.(text)
      }
    }

    rec.onerror = (event: any) => {
      // 'network' is common in Electron: Chromium ships without Google's
      // speech backend. We remember that so the UI can offer text input
      // instead of pretending the mic works.
      const reason = event?.error ?? 'unknown'
      console.warn('[speech] recognition error:', reason)
      if (reason === 'network' || reason === 'not-allowed' || reason === 'service-not-allowed') {
        setUnavailable(true)
      }
      setListening(false)
      onErrorRef.current?.(reason)
    }

    rec.onend = () => setListening(false)
    recognition.current = rec
    setSupported(true)

    return () => {
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
      recognition.current = null
    }
  }, [])

  const start = useCallback(() => {
    const rec = recognition.current
    if (!rec || unavailable) return false
    try {
      rec.start()
      setListening(true)
      return true
    } catch {
      return false
    }
  }, [unavailable])

  const stop = useCallback(() => {
    try {
      recognition.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.02
    utterance.pitch = 1.12
    utterance.volume = 0.9

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /Samantha|Aria|Zira|Google US English|Microsoft Aria/i.test(v.name)) ??
      voices.find((v) => v.lang?.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [])

  return { listening, caption, setCaption, supported, unavailable, start, stop, speak }
}

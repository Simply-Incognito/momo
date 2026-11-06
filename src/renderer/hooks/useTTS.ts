import { useCallback, useMemo } from 'react'

/**
 * Text-to-speech via the OS voices. Same tiny surface so an ElevenLabs
 * provider can replace it later.
 */
export function useTTS() {
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
      voices.find((voice) => /Samantha|Aria|Zira|Google US English|Microsoft Aria/i.test(voice.name)) ??
      voices.find((voice) => voice.lang?.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }, [])

  return useMemo(() => ({ speak, stop }), [speak, stop])
}

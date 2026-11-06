import { useCallback, useEffect, useRef, useState } from 'react'
import { VoiceRecorder } from '../lib/recorder'

export type VoiceError = 'permission' | 'no-mic' | 'too-short' | 'failed' | 'busy' | null

type Options = {
  onTranscript?: (text: string) => void
}

/**
 * Push-to-talk voice input:
 *   start() -> record -> stop() -> local Whisper -> onTranscript(text)
 */
export function useVoice({ onTranscript }: Options = {}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [level, setLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<VoiceError>(null)
  const [status, setStatus] = useState('')

  const recorder = useRef<VoiceRecorder | null>(null)
  const callback = useRef(onTranscript)
  callback.current = onTranscript

  useEffect(() => {
    return window.buddy.on('voice:status', (payload) => {
      const update = payload as { status?: string; progress?: number }
      if (update.status === 'downloading') {
        setStatus(`getting my ears ready · ${Math.round(update.progress ?? 0)}%`)
      } else if (update.status === 'loading-model') {
        setStatus('waking up my ears…')
      } else if (update.status === 'transcribing') {
        setStatus('thinking…')
      } else {
        setStatus('')
      }
    })
  }, [])

  const start = useCallback(async () => {
    if (recorder.current) return true
    setError(null)
    setTranscript('')
    setStatus('')
    try {
      const next = new VoiceRecorder()
      next.onLevel = setLevel
      await next.start()
      recorder.current = next
      setRecording(true)
      return true
    } catch (cause) {
      const name = (cause as { name?: string })?.name
      setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'no-mic')
      return false
    }
  }, [])

  const stop = useCallback(async () => {
    const current = recorder.current
    if (!current) return
    recorder.current = null
    setRecording(false)
    setLevel(0)

    const audio = await current.stop()
    if (audio.length < 16_000 * 0.35) {
      setError('too-short')
      return
    }

    setTranscribing(true)
    try {
      const result = await window.buddy.transcribe(audio)
      if (result?.ok && result.text) {
        setTranscript(result.text)
        callback.current?.(result.text)
      } else {
        setError(result?.error === 'too-short' ? 'too-short' : 'failed')
      }
    } catch {
      setError('failed')
    } finally {
      setTranscribing(false)
      setStatus('')
    }
  }, [])

  const toggle = useCallback(async () => {
    if (recorder.current) await stop()
    else await start()
  }, [start, stop])

  return { recording, transcribing, level, transcript, error, status, start, stop, toggle }
}

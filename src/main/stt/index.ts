import {
  ensureWhisperModel,
  transcribeWithWhisper,
  whisperModelReady,
  type StatusFn,
} from './whisper'
import { transcribeWithWindows, windowsSpeechAvailable } from './windows'

export type TranscriptionResult = {
  ok: boolean
  text: string
  engine?: 'whisper' | 'windows'
  error?: string
}

const MIN_SAMPLES = 16_000 * 0.35

// Loading the ONNX pipeline is expensive; remember if it has ever worked.
let whisperWarm = false
// If the runtime itself fails, don't make every utterance wait for it.
let whisperBroken = false

/**
 * Transcribe a 16 kHz mono clip.
 *
 * Strategy:
 *   - Whisper (accurate, local) when its model is already downloaded.
 *   - Windows desktop recognizer (instant, zero download) otherwise.
 *   - A background download upgrades future utterances to Whisper.
 *
 * Audio is transcribed locally in every path; nothing is uploaded.
 */
export async function transcribeAudio(
  audio: Float32Array,
  onStatus?: StatusFn,
): Promise<TranscriptionResult> {
  if (!audio || audio.length < MIN_SAMPLES) {
    return { ok: false, text: '', error: 'too-short' }
  }

  const modelReady = whisperModelReady()
  const shouldTryWhisper = !whisperBroken && (modelReady || !windowsSpeechAvailable())

  if (shouldTryWhisper) {
    try {
      if (!whisperWarm) onStatus?.({ status: 'loading-model' })
      const text = await transcribeWithWhisper(audio)
      whisperWarm = true
      if (!text) return { ok: false, text: '', engine: 'whisper', error: 'no-speech' }
      return { ok: true, text, engine: 'whisper' }
    } catch (error) {
      console.error('[stt] whisper failed:', error)
      whisperBroken = true
      if (!windowsSpeechAvailable()) {
        return { ok: false, text: '', error: 'whisper-failed' }
      }
    }
  }

  if (windowsSpeechAvailable()) {
    try {
      const text = await transcribeWithWindows(audio)

      // First-run upgrade: fetch Whisper quietly for next time. No status
      // events here so it never interrupts the conversation on screen.
      if (!whisperBroken && !whisperModelReady()) {
        ensureWhisperModel().catch((error) => {
          console.warn('[stt] background model download failed:', error)
        })
      }

      if (!text) return { ok: false, text: '', engine: 'windows', error: 'no-speech' }
      return { ok: true, text, engine: 'windows' }
    } catch (error) {
      console.error('[stt] windows speech failed:', error)
      return { ok: false, text: '', error: 'windows-failed' }
    }
  }

  return { ok: false, text: '', error: 'no-engine' }
}

/** Kick off the model download without blocking startup. */
export function preloadWhisperModel(): void {
  if (whisperBroken || whisperModelReady()) return
  ensureWhisperModel().catch((error) => {
    console.warn('[stt] preload failed:', error)
  })
}

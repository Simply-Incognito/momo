import { app } from 'electron'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  statSync,
  truncateSync,
  writeSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Local Whisper (transformers.js + ONNX Runtime).
 *
 * The quantized tiny English model is ~41 MB total. Downloads go straight to
 * userData/models and are resumable: a dropped connection continues from the
 * last byte instead of starting over. Inference then runs fully offline.
 */

export const WHISPER_MODEL = 'Xenova/whisper-tiny.en'

const REMOTE = `https://huggingface.co/${WHISPER_MODEL}/resolve/main/`

/** [path inside the model repo, expected byte size when known]. */
const FILES: Array<[string, number]> = [
  ['config.json', 0],
  ['generation_config.json', 0],
  ['preprocessor_config.json', 0],
  ['tokenizer.json', 0],
  ['tokenizer_config.json', 0],
  ['onnx/encoder_model_quantized.onnx', 10_124_913],
  ['onnx/decoder_model_merged_quantized.onnx', 30_727_382],
]

export type StatusFn = (update: { status: string; progress?: number }) => void

function modelsRoot(): string {
  return join(app.getPath('userData'), 'models')
}

function localPath(file: string): string {
  return join(modelsRoot(), WHISPER_MODEL, file)
}

/** A final (non-.part) file is ready when it exists with the expected size. */
function fileReady(file: string, expected: number): boolean {
  try {
    const { size } = statSync(localPath(file))
    return expected ? size >= expected : size > 0
  } catch {
    return false
  }
}

/** True when every expected file is present and fully sized. */
export function whisperModelReady(): boolean {
  return FILES.every(([file, expected]) => fileReady(file, expected))
}

let downloadPromise: Promise<void> | null = null

/**
 * Download the model files (idempotent, resumable). Safe to call repeatedly;
 * concurrent callers share one download and finished files are skipped.
 */
export function ensureWhisperModel(onStatus?: StatusFn): Promise<void> {
  if (!downloadPromise) {
    downloadPromise = (async () => {
      for (const [file, expected] of FILES) {
        if (fileReady(file, expected)) continue
        if (expected) onStatus?.({ status: 'downloading', progress: 0 })
        await downloadFile(file, expected, onStatus)
      }
      if (!whisperModelReady()) throw new Error('speech model incomplete')
    })().catch((error) => {
      downloadPromise = null
      throw error
    })
  }
  return downloadPromise
}

async function downloadFile(file: string, expected: number, onStatus?: StatusFn): Promise<void> {
  const destination = localPath(file)
  // Download into a sidecar so an interrupted write never looks complete.
  const partial = `${destination}.part`
  mkdirSync(dirname(destination), { recursive: true })

  for (let attempt = 1; attempt <= 10; attempt++) {
    let size = existsSync(partial) ? statSync(partial).size : 0

    try {
      const response = await fetch(REMOTE + file, {
        headers: size > 0 ? { Range: `bytes=${size}-` } : {},
        signal: AbortSignal.timeout(120_000),
      })

      // 416 means our partial already covers the whole file.
      if (response.status === 416 && size > 0) {
        renameSync(partial, destination)
        return
      }
      if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`)

      // Servers may ignore Range and send the whole file again.
      if (size > 0 && response.status === 200) {
        truncateSync(partial, 0)
        size = 0
      }

      const length = Number(response.headers.get('content-length')) || 0
      const total = response.status === 206 ? size + length : length
      const fd = openSync(partial, size > 0 ? 'a' : 'w')
      let written = size

      try {
        const body = response.body as unknown as AsyncIterable<Uint8Array> | null
        if (!body) throw new Error('empty response body')
        for await (const chunk of body) {
          writeSync(fd, chunk)
          written += chunk.length
          if (total) {
            const fraction = Math.min(1, written / total)
            // Encoder is ~20% of the bytes, decoder ~80%: keep one smooth bar.
            const overall = file.includes('encoder') ? fraction * 20 : 20 + fraction * 80
            onStatus?.({ status: 'downloading', progress: Math.round(overall) })
          }
        }
      } finally {
        closeSync(fd)
      }

      if (total && written < total) throw new Error(`incomplete ${written}/${total}`)
      if (expected && written < expected) throw new Error(`incomplete ${written}/${expected}`)
      renameSync(partial, destination)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[stt] ${file} attempt ${attempt} failed: ${message}`)
      await new Promise((resolve) => setTimeout(resolve, Math.min(20_000, 1_000 * attempt)))
    }
  }

  throw new Error(`could not download ${file}`)
}

let pipelinePromise: Promise<any> | null = null

async function getPipeline(): Promise<any> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      await ensureWhisperModel()

      // Loaded lazily: the ONNX runtime is memory-heavy and only needed once
      // the user actually speaks.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pipeline, env } = require('@huggingface/transformers')
      const models = modelsRoot()
      env.cacheDir = models
      env.localModelPath = models
      env.allowLocalModels = true
      env.allowRemoteModels = false

      const started = Date.now()
      console.log('[stt] loading whisper pipeline…')
      const transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, { dtype: 'q8' })
      console.log(`[stt] whisper ready in ${Date.now() - started}ms`)
      return transcriber
    })()

    pipelinePromise.catch(() => {
      pipelinePromise = null
    })
  }
  return pipelinePromise
}

export async function transcribeWithWhisper(audio: Float32Array): Promise<string> {
  const transcriber = await getPipeline()
  const started = Date.now()
  const result = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 })
  console.log(`[stt] transcribed ${(audio.length / 16_000).toFixed(1)}s in ${Date.now() - started}ms`)
  return (typeof result === 'string' ? result : result?.text ?? '').trim()
}

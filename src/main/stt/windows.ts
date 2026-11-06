import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { encodeWav } from './wav'

/**
 * Zero-download speech-to-text using the Windows desktop recognizer
 * (System.Speech). It is not as accurate as Whisper, but it works instantly
 * and offline, which makes it a great first-run fallback on Windows.
 */
export function windowsSpeechAvailable(): boolean {
  return process.platform === 'win32'
}

export async function transcribeWithWindows(audio: Float32Array): Promise<string> {
  if (!windowsSpeechAvailable()) throw new Error('windows-speech-unavailable')

  const wavPath = join(tmpdir(), `momo-voice-${randomUUID()}.wav`)
  await fs.writeFile(wavPath, encodeWav(audio))

  // Single-quoted PowerShell string; escape any embedded single quotes.
  const quotedPath = wavPath.replace(/'/g, "''")
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine',
    '$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))',
    `$engine.SetInputToWaveFile('${quotedPath}')`,
    '$result = $engine.Recognize()',
    'if ($result) { [Console]::Out.Write($result.Text) }',
    '$engine.Dispose()',
  ].join('; ')

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024 },
        (error, out) => {
          if (error) reject(error)
          else resolve(String(out ?? ''))
        },
      )
    })

    return stdout.replace(/^\uFEFF/, '').trim()
  } finally {
    await fs.unlink(wavPath).catch(() => {})
  }
}

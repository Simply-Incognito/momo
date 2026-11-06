/**
 * Microphone recorder that produces 16 kHz mono Float32 PCM, which is exactly
 * what Whisper wants. We record raw audio instead of using MediaRecorder so
 * there is no container/codec to decode afterwards.
 */

const TARGET_RATE = 16_000

function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const length = Math.round(input.length / ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, input.length - 1)
    const fraction = position - index
    output[i] = input[index] * (1 - fraction) + input[next] * fraction
  }
  return output
}

export class VoiceRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: Float32Array[] = []
  private nativeRate = TARGET_RATE

  /** Called with a smoothed 0..1 loudness value while recording. */
  onLevel?: (level: number) => void

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-media-devices')

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    this.ctx = new AudioContext()
    this.nativeRate = this.ctx.sampleRate
    await this.ctx.resume()

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    // The processor only runs when connected to the destination; use a silent
    // gain node so the mic is not echoed back to the speakers.
    this.sink = this.ctx.createGain()
    this.sink.gain.value = 0

    this.chunks = []
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(input))

      let sum = 0
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
      const rms = Math.sqrt(sum / input.length)
      this.onLevel?.(Math.min(1, rms * 8))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.sink)
    this.sink.connect(this.ctx.destination)
  }

  async stop(): Promise<Float32Array> {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.sink?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())

    const rate = this.nativeRate
    this.stream = null
    this.source = null
    this.processor = null
    this.sink = null
    try {
      await this.ctx?.close()
    } catch {
      /* already closed */
    }
    this.ctx = null

    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of this.chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks = []

    return resample(merged, rate, TARGET_RATE)
  }
}

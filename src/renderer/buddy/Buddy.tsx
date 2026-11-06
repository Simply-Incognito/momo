import { useCallback, useEffect, useRef, useState } from 'react'
import CharacterCanvas, { type BuddyState } from '../components/CharacterCanvas'
import SpeechBubble from '../components/SpeechBubble'
import { useTTS } from '../hooks/useTTS'
import { useVoice, type VoiceError } from '../hooks/useVoice'
import { replyTo } from '../services/brain'

const CHAR_SIZE = 240
const NAP_AFTER_MS = 90_000

const VOICE_ERRORS: Record<Exclude<VoiceError, null>, string> = {
  permission: 'I need microphone permission before I can listen.',
  'no-mic': "I couldn't find a microphone.",
  'too-short': "That was too quick — hold on a moment longer next time.",
  failed: "I couldn't make out the words. Try again?",
  busy: "I'm already working on it.",
}

export default function Buddy() {
  const [state, setState] = useState<BuddyState>('idle')
  const [cursor, setCursor] = useState<{ x: number; y: number }>()
  const [bubble, setBubble] = useState('')
  const [amplitude, setAmplitude] = useState(0)
  const [muted, setMuted] = useState(false)

  const charRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    winX: number
    winY: number
    moved: boolean
  } | null>(null)
  const napTimer = useRef<number | undefined>(undefined)
  const ampTimer = useRef<number | undefined>(undefined)

  const tts = useTTS()

  const stopAmplitude = useCallback(() => {
    if (ampTimer.current) window.clearInterval(ampTimer.current)
    ampTimer.current = undefined
    setAmplitude(0)
  }, [])

  const say = useCallback(
    (text: string) => {
      setBubble(text)
      setState('talking')
      setAmplitude(0.5)
      if (ampTimer.current) window.clearInterval(ampTimer.current)
      ampTimer.current = window.setInterval(() => {
        setAmplitude(0.25 + Math.random() * 0.6)
      }, 90)
      tts.speak(text, () => {
        stopAmplitude()
        setState('idle')
        setBubble('')
      })
    },
    [tts, stopAmplitude],
  )

  const handleFinal = useCallback(
    async (text: string) => {
      if (!text) return
      setState('thinking')
      const reply = await replyTo(text)
      window.setTimeout(() => say(reply), 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const voice = useVoice({ onTranscript: handleFinal })
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  /* Drive the character from the voice loop. */
  useEffect(() => {
    if (voice.recording) setState('listening')
    else if (voice.transcribing) setState('thinking')
    else if (!bubble) setState((prev) => (prev === 'listening' || prev === 'thinking' ? 'idle' : prev))
  }, [voice.recording, voice.transcribing, bubble])

  /* Speak a friendly line when something goes wrong. */
  useEffect(() => {
    if (!voice.error) return
    setState('surprised')
    say(VOICE_ERRORS[voice.error])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.error])

  const noteActivity = useCallback(() => {
    if (napTimer.current) window.clearTimeout(napTimer.current)
    setState((prev) => (prev === 'sleepy' ? 'idle' : prev))
    napTimer.current = window.setTimeout(() => {
      if (!voiceRef.current.recording) setState('sleepy')
    }, NAP_AFTER_MS)
  }, [])

  /* Greeting + global hotkey / tray events. */
  useEffect(() => {
    const offPtt = window.buddy.on('ptt:toggle', () => {
      const current = voiceRef.current
      if (current.transcribing) return
      noteActivity()
      void current.toggle()
    })

    const offMuted = window.buddy.on('mic-muted', (value) => {
      setMuted(Boolean(value))
      if (value) {
        const current = voiceRef.current
        if (current.recording) void current.stop()
      }
    })

    window.buddy.loadMemory().then((memory) => {
      const greeting = memory?.lastSeen
        ? 'Oh, you’re back. Good.'
        : "Hi, I'm momo! Press Ctrl+Space and talk to me."
      window.setTimeout(() => say(greeting), 700)
    })

    noteActivity()
    return () => {
      offPtt()
      offMuted()
      if (napTimer.current) window.clearTimeout(napTimer.current)
      stopAmplitude()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerDown = (event: React.PointerEvent) => {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    window.buddy.getWindowPosition().then((pos) => {
      dragRef.current = {
        startX: event.screenX,
        startY: event.screenY,
        winX: pos.x,
        winY: pos.y,
        moved: false,
      }
    })
    noteActivity()
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const rect = charRef.current?.getBoundingClientRect()
    if (rect) setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    noteActivity()

    const drag = dragRef.current
    if (!drag) return
    const dx = event.screenX - drag.startX
    const dy = event.screenY - drag.startY
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    if (drag.moved) window.buddy.setWindowPosition(drag.winX + dx, drag.winY + dy)
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag && !drag.moved) {
      setState('happy')
      window.setTimeout(() => setState('idle'), 700)
      window.buddy.openPanel()
    }
  }

  const bubbleText = voice.status || (voice.recording ? '…' : bubble)
  const caption = voice.recording
    ? 'listening…'
    : voice.transcribing
      ? 'working it out…'
      : voice.transcript
        ? `“${voice.transcript}”`
        : undefined

  return (
    <div
      className={`buddy ${muted ? 'buddy--muted' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (dragRef.current = null)}
      title="Drag to move · click to open · Ctrl+Space to talk"
    >
      <div className="buddy__bubble">
        <SpeechBubble text={bubbleText} caption={caption} holdMs={voice.recording || voice.status ? 0 : 6000} />
      </div>
      <div className="buddy__character" ref={charRef}>
        <CharacterCanvas state={state} cursor={cursor} amplitude={amplitude} size={CHAR_SIZE} />
      </div>
    </div>
  )
}

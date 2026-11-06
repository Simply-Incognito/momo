import { useCallback, useEffect, useRef, useState } from 'react'
import CharacterCanvas, { type BuddyState } from '../components/CharacterCanvas'
import SpeechBubble from '../components/SpeechBubble'
import { useSpeech } from '../hooks/useSpeech'
import { replyTo } from '../services/brain'

const CHAR_SIZE = 240
const NAP_AFTER_MS = 90_000

export default function Buddy() {
  const [state, setState] = useState<BuddyState>('idle')
  const [cursor, setCursor] = useState<{ x: number; y: number }>()
  const [bubble, setBubble] = useState('')
  const [amplitude, setAmplitude] = useState(0)
  const [muted, setMuted] = useState(false)
  const [voiceIssue, setVoiceIssue] = useState<string | null>(null)

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
  const listeningRef = useRef(false)

  const handleFinal = useCallback(
    async (text: string) => {
      if (!text) return
      setState('thinking')
      const reply = await replyTo(text)
      // Small beat so "thinking" reads as intentional, not lag.
      window.setTimeout(() => say(reply), 450)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { listening, caption, setCaption, unavailable, start, stop, speak } = useSpeech({
    onFinal: handleFinal,
    onError: (reason) => {
      setState('surprised')
      setVoiceIssue(
        reason === 'not-allowed' || reason === 'service-not-allowed'
          ? "I need microphone permission before I can listen."
          : "My mic can't reach a speech service in this build. You can type to me in the panel for now.",
      )
    },
  })
  listeningRef.current = listening

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
      speak(text, () => {
        stopAmplitude()
        setState('idle')
        setBubble('')
      })
    },
    [speak, stopAmplitude],
  )

  /* Speak a friendly line whenever the mic fails. */
  useEffect(() => {
    if (!voiceIssue) return
    const timer = window.setTimeout(() => {
      say(voiceIssue)
      setVoiceIssue(null)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [voiceIssue, say])

  /* Wake on any activity and schedule a nap when idle. */
  const noteActivity = useCallback(() => {
    if (napTimer.current) window.clearTimeout(napTimer.current)
    setState((prev) => (prev === 'sleepy' ? 'idle' : prev))
    napTimer.current = window.setTimeout(() => {
      if (!listeningRef.current) setState('sleepy')
    }, NAP_AFTER_MS)
  }, [])

  /* Greeting + global hotkey / tray events from the main process. */
  useEffect(() => {
    const offPtt = window.buddy.on('ptt:toggle', () => {
      if (listeningRef.current) {
        stop()
        setState('idle')
      } else if (start()) {
        noteActivity()
        setState('listening')
        setCaption('')
      } else {
        setState('surprised')
        say(
          unavailable
            ? "My mic isn't working in this build. Type to me in the panel instead."
            : "My ears aren't working right now.",
        )
      }
    })

    const offMuted = window.buddy.on('mic-muted', (value) => {
      setMuted(Boolean(value))
      if (value && listeningRef.current) {
        stop()
        setState('idle')
      }
    })

    window.buddy.loadMemory().then((memory) => {
      if (!memory?.lastSeen) {
        window.setTimeout(
          () => say("Hi, I'm momo! Click me to say hello, or press Ctrl+Space to talk."),
          700,
        )
      } else {
        window.setTimeout(() => say('Oh, you’re back. Good.'), 700)
      }
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

  /* Listening state follows the microphone. */
  useEffect(() => {
    if (listening) {
      setState('listening')
      noteActivity()
    } else if (state === 'listening') {
      setState('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

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
    // Eye tracking
    const rect = charRef.current?.getBoundingClientRect()
    if (rect) {
      setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
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

  const bubbleCaption = listening ? caption || 'listening…' : undefined

  return (
    <div
      className={`buddy ${muted ? 'buddy--muted' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (dragRef.current = null)}
      title="Drag to move · click to open"
    >
      <div className="buddy__bubble">
        <SpeechBubble text={bubble || (listening ? '…' : '')} caption={bubbleCaption} />
      </div>
      <div className="buddy__character" ref={charRef}>
        <CharacterCanvas
          state={state}
          cursor={listening ? undefined : cursor}
          amplitude={amplitude}
          size={CHAR_SIZE}
        />
      </div>
    </div>
  )
}

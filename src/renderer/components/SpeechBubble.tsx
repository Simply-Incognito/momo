import { useEffect, useState } from 'react'

type Props = {
  text: string
  caption?: string
  /** How long the bubble stays before fading, in ms. 0 keeps it until text changes. */
  holdMs?: number
}

/**
 * Soft glass speech bubble that fades in and out.
 * Purely presentational — the character decides what to say.
 */
export default function SpeechBubble({ text, caption, holdMs = 6000 }: Props) {
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState({ text: '', caption: '' })

  useEffect(() => {
    if (!text) {
      setVisible(false)
      return
    }
    setShown({ text, caption: caption ?? '' })
    setVisible(true)

    if (holdMs > 0) {
      const timer = setTimeout(() => setVisible(false), holdMs)
      return () => clearTimeout(timer)
    }
  }, [text, caption, holdMs])

  if (!shown.text) return null

  return (
    <div className={`bubble ${visible ? 'bubble--visible' : ''}`} role="status" aria-live="polite">
      {shown.caption && <div className="bubble__caption">{shown.caption}</div>}
      <div className="bubble__text">{shown.text}</div>
    </div>
  )
}

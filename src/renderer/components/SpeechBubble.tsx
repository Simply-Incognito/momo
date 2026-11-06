// SpeechBubble.tsx
// A beautiful glassmorphism speech bubble that fades in/out
// Displays the character's dialogue and live caption

import React from 'react'

type SpeechBubbleProps = {
  visible: boolean
  text: string // The actual speech
  caption: string // Live transcription of what user said
  onClose?: () => void
  theme: 'light' | 'dark'
  accentColor: string
}

const glassStyle = (accentColor: string, theme: 'light' | 'dark') => {
  const base = theme === 'dark'
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.3)'
  
  return {
    background: base,
    backdropFilter: 'blur(12px)',
    border: `1px solid rgba(255, 255, 255, 0.2)`,
    borderRadius: '20px',
    padding: '12px 20px',
    margin: '8px',
    maxWidth: '220px',
    color: theme === 'dark' ? '#FFFFFF' : '#2C3E50',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    lineHeight: '1.5',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s ease, transform 0.2s ease',
    ...(accentColor && `border-color: ${accentColor};`),
  }
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  visible,
  text,
  caption,
  onClose,
  theme,
  accentColor
}) => {
  const [opacity, setOpacity] = React.useState(visible ? 1 : 0)

  useEffect(() => {
    if (visible) {
      setOpacity(1)
    } else {
      setOpacity(0.3)
      setTimeout(() => onClose?.(), 300)
    }
  }, [visible, onClose])

  if (!visible && opacity < 0.5) {
    return null
  }

  return (
    <div
      style={{
        ...glassStyle(accentColor, theme),
        opacity,
        transform: `translateY(${opacity < 1 ? -10 : 0}px)`
      }}
    >
      {/* Caption area at top - smaller, muted */}
      {caption && (
        <div 
          style={{
            fontSize: '11px',
            color: theme === 'dark' ? '#AAA' : '#666',
            marginBottom: '6px',
            marginTop: '2px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          listening: {caption}
        </div>
      )}
      
      {/* Main speech text */}
      <div 
        style={{
          fontSize: '14px',
          marginBottom: '6px',
          minHeight: '36px',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export default SpeechBubble
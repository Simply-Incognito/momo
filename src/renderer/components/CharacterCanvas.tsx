// CharacterCanvas.tsx
// A canvas-based animation component for the Buddy character
// Uses PixiJS for smooth 60fps rendering with low CPU/GPU

import * as PIXI from 'pixi.js'
import { useEffect, useRef } from 'react'

// Character definition - Puff the Cute Blob Spirit
// This can be swapped based on user preference

type CharacterState = 
  | 'idle' 
  | 'listening' 
  | 'thinking' 
  | 'talking' 
  | 'happy' 
  | 'sad' 
  | 'surprised' 
  | 'sleepy'

type CharacterProps = {
  state?: CharacterState
  onStateChange?: (state: CharacterState) => void
  position?: { x: number; y: number }
}

const colors = {
  puff: {
    idle: '#FFD1E8',
    listening: '#FFB3BA', 
    thinking: '#D7BDE2',
    talking: '#FF6B6B',
    happy: '#FF8C42',
    sad: '#89CFF0',
    surprised: '#FFEAA7',
    sleepy: '#A8D5FF',
  }
}

export const CharacterCanvas: React.FC<CharacterProps> = ({
  state: initialState,
  onStateChange,
  position = { x: 0, y: 0 }
}) => {
  const ref = useRef<PIXI.Application | null>(null)
  const [state, setState] = React.useState(initialState || 'idle')

  useEffect(() => {
    if (!ref.current) return

    const app = ref.current
    const stage = app.stage

    // Remove previous character if exists
    const existing = stage.getChildByName('buddy-character')
    if (existing) existing.destroy()

    // Create the character based on state
    createBuddyCharacter(app, stage, state)

    // Handle state changes
    if (onStateChange) {
      onStateChange(state)
    }

    // Cleanup on unmount
    return () => {
      if (existing) existing.destroy()
      // Don't destroy app here as it may be shared
    }
  }, [state, onStateChange])

  // Create the buddy character using vector graphics
  function createBuddyCharacter(app: PIXI.Application, stage: PIXI.Container, state: CharacterState) {
    const graphics = new PIXI.Graphics()
    
    // Draw a cute blob-like creature
    const baseColor = PIXI.Color.parse(colors puff[state] || colors.puff.idle)
    
    // Body - main blob
    graphics.beginPath()
    graphics.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2)
    graphics.closePath()
    
    // Soft fill with gradient effect
    const gradient = graphics.createLinearGradient(0, -100, 0, 100)
    gradient.addColorStop(0, baseColor.lighten(30).toHex())
    gradient.addColorStop(1, baseColor.toHex())
    graphics.fillColor = gradient
    graphics.fill()
    
    // Eyes - big and expressive
    graphics.beginPath()
    // Left eye
    graphics.ellipse(-30, -20, 25, 30, 0, 0, Math.PI * 2)
    // Right eye  
    graphics.ellipse(30, -20, 25, 30, 0, 0, Math.PI * 2)
    graphics.closePath()
    
    // Eye white
    graphics.fillColor = 0xFFFFFF
    graphics.fill()
    
    // Pupils
    graphics.beginPath()
    graphics.ellipse(-30, -20, 12, 15, 0, 0, Math.PI * 2)
    graphics.ellipse(30, -20, 12, 15, 0, 0, Math.PI * 2)
    graphics.closePath()
    graphics.fillColor = 0x2C3E50
    graphics.fill()
    
    // Cheeks (blush)
    graphics.beginPath()
    graphics.arc(-45, 30, 15, 0, Math.PI * 2)
    graphics.arc(45, 30, 15, 0, Math.PI * 2)
    graphics.closePath()
    graphics.fillColor = baseColor.lighten(20).toHex()
    graphics.fill()
    
    // Mouth - subtle, changes with state
    graphics.beginPath()
    graphics.arc(0, 20, 15, 0, Math.PI, true)
    graphics.lineWidth = 2
    graphics.strokeColor = baseColor.darken(30).toHex()
    graphics.stroke()
    
    // Add some sparkle/glow effect based on state
    if (state === 'listening' || state === 'talking' || state === 'surprised') {
      // Add glow
      const glow = new PIXI.Graphics()
      glow.beginPath()
      glow.ellipse(0, -50, 120, 80, 0, 0, Math.PI * 2)
      glow.closePath()
      glow.fillAlpha = 0.1
      glow.fillColor = baseColor.toHex()
      stage.addChild(glow)
      // Animate glow out
      glow.tween.from({ alpha: 0.3 }).to({ alpha: 0 }, { duration: 1500, onComplete: () => glow.destroy() })
    }
    
    graphics.name = 'buddy-character'
    graphics.x = app.screen.width / 2
    graphics.y = app.screen.height / 2
    stage.addChild(graphics)
    
    // Add idle behaviors - subtle animation
    animateCharacter(graphics, state)
  }

  // Spring-based animation for idle behavior
  function animateCharacter(graphics: PIXI.Graphics, state: CharacterState) {
    const spring = { x: 0, y: 0, velocity: 0 }
    const tick = () => {
      // Idle: gentle breathing (scale)
      const breathing = Math.sin(Date.now() / 200) * 0.02
      graphics.scale.set(1 + breathing, 1 + breathing)
      
      // Eye movement - look around gently
      const lookX = Math.sin(Date.now() / 500) * 0.5
      const lookY = Math.cos(Date.now() / 700) * 0.5
      // In a full implementation, we'd animate the pupil positions
      
      // State-specific behaviors
      switch (state) {
        case 'listening':
          // Eyes widen, subtle glow
          break
        case 'talking':
          // Mouth opens with audio amplitude (handled externally)
          break
        case 'thinking':
          // Gentle swirl
          graphics.rotation += 0.005
          break
        case 'sleepy':
          // Slow, droopy motion
          graphics.y += Math.sin(Date.now() / 1000) * 0.3
          break
        case 'surprised':
          // Quick flash then settle
          break
      }
      
      requestAnimationFrame(tick)
    }
    tick()
  }

  return null // This component manages its own canvas via ref
}

export default CharacterCanvas
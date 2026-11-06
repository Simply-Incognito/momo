// services/AnimationService.ts
// Handles the character animation states and behaviors
// Uses the canvas/PixiJS approach for smooth 60fps animations

import * as PIXI from 'pixi.js'
import { useEffect, useRef } from 'react'

type AnimationState = 
  | 'idle' 
  | 'listening' 
  | 'thinking' 
  | 'talking' 
  | 'happy' 
  | 'sad' 
  | 'surprised' 
  | 'sleepy'

type AnimationConfig = {
  idleWander: boolean
  napAfterInactiveMs: number
  reactToCursor: boolean
  cursorRadius: number
}

export class AnimationService {
  private app: PIXI.Application | null = null
  private characterGraphics: PIXI.Graphics | null = null
  private state: AnimationState = 'idle'
  private lastInteraction = Date.now()
  private cursorPosition = { x: 0, y: 0 }
  private isInteracting = false

  // Configure animation behaviors
  configure(config: Partial<AnimationConfig>) {
    // Apply configuration
    if (config.idleWander !== undefined) { /* ... */ }
    if (config.napAfterInactiveMs !== undefined) { /* ... */ }
    if (config.reactToCursor !== undefined) { /* ... */ }
    if (config.cursorRadius !== undefined) { /* ... */ }
  }

  // Set the PIXI app instance (called from React component)
  setApp(app: PIXI.Application) {
    this.app = app
    const stage = app.stage
    
    // Create character if not exists
    if (!stage.getChildByName('buddy-character')) {
      const graphics = new PIXI.Graphics()
      this.setupCharacter(graphics)
      graphics.name = 'buddy-character'
      graphics.x = this.app!.screen.width / 2
      graphics.y = this.app!.screen.height / 2
      stage.addChild(graphics)
      this.characterGraphics = graphics
    }
    
    this.animate()
  }

  private setupCharacter(graphics: PIXI.Graphics) {
    // Draw Puff the blob creature
    const baseColor = 0xFFD1E8 // Pastel pink
    
    // Body
    graphics.beginPath()
    graphics.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2)
    graphics.closePath()
    
    // Soft gradient fill
    const gradient = graphics.createLinearGradient(0, -100, 0, 100)
    gradient.addColorStop(0, '#FFD1E8')
    gradient.addColorStop(1, '#FFB3BA')
    graphics.fillColor = gradient
    graphics.fill()
    
    // Eyes
    graphics.beginPath()
    graphics.ellipse(-30, -20, 25, 30, 0, 0, Math.PI * 2)
    graphics.ellipse(30, -20, 25, 30, 0, 0, Math.PI * 2)
    graphics.closePath()
    graphics.fillColor = 0xFFFFFF
    graphics.fill()
    
    // Pupils
    graphics.beginPath()
    graphics.ellipse(-30, -20, 12, 15, 0, 0, Math.PI * 2)
    graphics.ellipse(30, -20, 12, 15, 0, 0, Math.PI * 2)
    graphics.closePath()
    graphics.fillColor = 0x2C3E50
    graphics.fill()
    
    // Cheeks
    graphics.beginPath()
    graphics.arc(-45, 30, 15, 0, Math.PI * 2)
    graphics.arc(45, 30, 15, 0, Math.PI * 2)
    graphics.closePath()
    graphics.fillColor = 0xFFB3BA
    graphics.fill()
    
    // Subtle mouth
    graphics.beginPath()
    graphics.arc(0, 20, 15, 0, Math.PI, true)
    graphics.lineWidth = 2
    graphics.strokeColor = 0xFF6B6B
    graphics.stroke()
  }

  // Set character state (called from IPC)
  setState(state: AnimationState) {
    this.state = state
    this.lastInteraction = Date.now()
    this.updateVisualState()
  }

  // Update visual appearance based on state
  private updateVisualState() {
    if (!this.characterGraphics) return
    
    const g = this.characterGraphics
    const baseColor = 0xFFD1E8
    
    // Clear and redraw based on state
    g.removeChildren()
    
    switch (this.state) {
      case 'idle':
        this.drawIdle(g, baseColor)
        break
      case 'listening':
        this.drawListening(g, baseColor)
        break
      case 'thinking':
        this.drawThinking(g, baseColor)
        break
      case 'talking':
        this.drawTalking(g, baseColor)
        break
      case 'happy':
        this.drawHappy(g, baseColor)
        break
      case 'sad':
        this.drawSad(g, baseColor)
        break
      case 'surprised':
        this.drawSurprised(g, baseColor)
        break
      case 'sleepy':
        this.drawSleepy(g, baseColor)
        break
    }
    
    // Start animation loop
    this.animate()
  }

  private drawIdle(g: PIXI.Graphics, color: number) {
    // Regular blob, breathing
    g.beginPath()
    g.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = color
    g.fill()
    
    // Eyes looking around gently
    g.beginPath()
    g.ellipse(-30 + Math.sin(Date.now() / 500) * 2, -20, 25, 30, 0, 0, Math.PI * 2)
    g.ellipse(30 + Math.cos(Date.now() / 700) * 2, -20, 25, 30, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Pupils
    g.beginPath()
    g.ellipse(-30 + Math.sin(Date.now() / 500) * 3, -20 + Math.cos(Date.now() / 800) * 3, 12, 15, 0, 0, Math.PI * 2)
    g.ellipse(30 + Math.cos(Date.now() / 700) * 3, -20 + Math.sin(Date.now() / 900) * 3, 12, 15, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Blush
    g.beginPath()
    g.arc(-45, 30, 15, 0, Math.PI * 2)
    g.arc(45, 30, 15, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFB3BA
    g.fill()
    
    // Subtle mouth
    g.beginPath()
    g.arc(0, 20, 15, 0, Math.PI, true)
    g.lineWidth = 2
    g.strokeColor = 0xFF6B6B
    g.stroke()
  }

  private drawListening(g: PIXI.Graphics, color: number) {
    // Eyes widen
    g.beginPath()
    g.ellipse(-30, -30, 30, 40, 0, 0, Math.PI * 2)
    g.ellipse(30, -30, 30, 40, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Dilated pupils
    g.beginPath()
    g.ellipse(-30, -30, 18, 25, 0, 0, Math.PI * 2)
    g.ellipse(30, -30, 18, 25, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Glow effect
    const glow = new PIXI.Graphics()
    glow.beginPath()
    glow.ellipse(0, -50, 130, 90, 0, 0, Math.PI * 2)
    glow.closePath()
    glow.fillAlpha = 0.15
    glow.fillColor = color
    g.parent?.addChildAt(glow, g.zIndex + 1)
    
    // Blush more prominent
    g.beginPath()
    g.arc(-45, 30, 20, 0, Math.PI * 2)
    g.arc(45, 30, 20, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFB3BA
    g.fill()
    
    // Small "oh" mouth
    g.beginPath()
    g.arc(0, 20, 10, 0, Math.PI, true)
    g.lineWidth = 3
    g.strokeColor = 0xFF6B6B
    g.stroke()
  }

  private drawThinking(g: PIXI.Graphics, color: number) {
    // Slightly squinted eyes
    g.beginPath()
    g.ellipse(-30, -15, 25, 25, 0, 0, Math.PI * 2)
    g.ellipse(30, -15, 25, 25, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Thinking pose - small swirl animation handled separately
    g.beginPath()
    g.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2)
    g.closePath()
    
    // Swirl gradient
    const gradient = g.createLinearGradient(0, -100, 0, 100)
    gradient.addColorStop(0, '#D7BDE2')
    gradient.addColorStop(1, color.toString())
    g.fillColor = gradient
    g.fill()
    
    // Relaxed pupils looking down/around
    g.beginPath()
    g.ellipse(-30, 0, 12, 12, 0, 0, Math.PI * 2)
    g.ellipse(30, 0, 12, 12, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Subtle mouth
    g.beginPath()
    g.arc(0, 25, 8, 0, Math.PI, true)
    g.lineWidth = 1
    g.strokeColor = 0x845EC2
    g.stroke()
  }

  private drawTalking(g: PIXI.Graphics, color: number) {
    // Open mouth synced to audio
    g.beginPath()
    g.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2)
    g.closePath()
    
    // Talking color
    const gradient = g.createLinearGradient(0, -100, 0, 100)
    gradient.addColorStop(0, '#FF6B6B')
    gradient.addColorStop(1, color.toString())
    g.fillColor = gradient
    g.fill()
    
    // Open eyes - excitement
    g.beginPath()
    g.ellipse(-30, -25, 35, 40, 0, 0, Math.PI * 2)
    g.ellipse(30, -25, 35, 40, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Big pupils
    g.beginPath()
    g.ellipse(-30, -25, 20, 25, 0, 0, Math.PI * 2)
    g.ellipse(30, -25, 20, 25, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Tongue indicator
    g.beginPath()
    g.arc(0, 40, 8, 0, Math.PI * 2)
    g.fillColor = '#FF6B6B'
    g.fill()
    
    // Happy blush
    g.beginPath()
    g.arc(-45, 30, 15, 0, Math.PI * 2)
    g.arc(45, 30, 15, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFB3BA
    g.fill()
  }

  private drawHappy(g: PIXI.Graphics, color: number) {
    // Bright, happy eyes
    g.beginPath()
    g.ellipse(-30, -20, 30, 35, 0, 0, Math.PI * 2)
    g.ellipse(30, -20, 30, 35, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Sparkling pupils
    g.beginPath()
    g.arc(-30, -22, 8, 0, Math.PI * 2)
    g.arc(30, -22, 8, 0, Math.PI * 2)
    g.fillColor = 0xFFE5B4
    g.fill()
    
    // Big smile
    g.beginPath()
    g.arc(0, 30, 20, 0.5, 1.5 * Math.PI, true)
    g.lineWidth = 3
    g.strokeColor = '#FF6B6B'
    g.stroke()
    
    // Rosy cheeks
    g.beginPath()
    g.arc(-45, 35, 15, 0, Math.PI * 2)
    g.arc(45, 35, 15, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = '#FFB3BA'
    g.fill()
  }

  private drawSad(g: PIXI.Graphics, color: number) {
    // Droopy eyes
    g.beginPath()
    g.ellipse(-30, -10, 25, 35, 0, 0, Math.PI * 2)
    g.ellipse(30, -10, 25, 35, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Downward pupils
    g.beginPath()
    g.arc(-30, 0, 12, 0, Math.PI, true)
    g.arc(30, 0, 12, 0, Math.PI, true)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Frowning mouth
    g.beginPath()
    g.arc(0, 20, 15, 0, Math.PI, false)
    g.lineWidth = 2
    g.strokeColor = '#89CFF0'
    g.stroke()
    
    // Tear drops
    g.beginPath()
    g.moveTo(-35, 10)
    g.lineTo(-45, -10)
    g.moveTo(35, 10)
    g.lineTo(45, -10)
    g.strokeColor = '#89CFF0'
    g.lineWidth = 1
    g.stroke()
    
    // Sad blush (dimmer)
    g.beginPath()
    g.arc(-45, 30, 10, 0, Math.PI * 2)
    g.arc(45, 30, 10, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = '#A8D5FF'
    g.fill()
  }

  private drawSurprised(g: PIXI.Graphics, color: number) {
    // Wide eyes
    g.beginPath()
    g.ellipse(-35, -35, 40, 50, 0, 0, Math.PI * 2)
    g.ellipse(35, -35, 40, 50, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Very large pupils
    g.beginPath()
    g.ellipse(-35, -35, 25, 35, 0, 0, Math.PI * 2)
    g.ellipse(35, -35, 25, 35, 0, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = 0x2C3E50
    g.fill()
    
    // Raised eyebrows (implied by eye shape)
    // Open "o" mouth
    g.beginPath()
    g.arc(0, 20, 20, 0, Math.PI, true)
    g.lineWidth = 3
    g.strokeColor = '#FFEAA7'
    g.stroke()
    
    // Temporary blush
    g.beginPath()
    g.arc(-45, 30, 15, 0, Math.PI * 2)
    g.arc(45, 30, 15, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = '#FFEAA7'
    g.fill()
  }

  private drawSleepy(g: PIXI Graphics, color: number) {
    // Half-closed eyes
    g.beginPath()
    g.arc(-30, 0, 20, 0.2, 3.0, false)  // left eye half open
    g.arc(30, 0, 20, 0.2, 3.0, false)   // right eye half open
    g.closePath()
    g.fillColor = 0xFFFFFF
    g.fill()
    
    // Sleepy dots
    g.beginPath()
    g.arc(-30, 0, 8, 0, Math.PI * 2)
    g.arc(30, 0, 8, 0, Math.PI * 2)
    g.fillColor = '#A8D5FF'
    g.fill()
    
    // Relaxed mouth
    g.beginPath()
    g.arc(0, 30, 10, 0, Math.PI, false)
    g.lineWidth = 1
    g.strokeColor = '#A8D5FF'
    g.stroke()
    
    // Closed blush
    g.beginPath()
    g.arc(-45, 30, 8, 0, Math.PI * 2)
    g.arc(45, 30, 8, 0, Math.PI * 2)
    g.closePath()
    g.fillColor = '#A8D5FF'
    g.fill()
  }

  // Main animation loop at 60fps
  private animate = () => {
    if (!this.app) return
    
    // Idle wander behavior
    if (this.state === 'idle' && this.isInteracting) {
      // Gently wander toward cursor
      const dx = this.cursorPosition.x - this.app.screen.width / 2
      const dy = this.cursorPosition.y - this.app.screen.height / 2
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance > 50 && distance < 400) {
        // Move character toward cursor with spring physics
        const force = -0.02 * distance
        // Apply gentle movement
        g?.x += force * dx / (distance || 1)
        g?.y += force * dy / (distance || 1)
      }
    }
    
    // Check for nap after inactivity
    const idleTime = Date.now() - this.lastInteraction
    if (this.state === 'idle' && idleTime > 300000 && !this.isInteracting) { // 5 min
      // Transition to sleepy after long inactivity
      this.setState('sleepy')
    }
    
    // Request next frame
    requestAnimationFrame(this.animate)
  }

  // Handle cursor move for reactive behavior
  onCursorMove(x: number, y: number) {
    this.cursorPosition = { x, y }
    // If character is idle and user is nearby, perk up
    if (this.state === 'idle') {
      const dist = Math.hypot(
        x - this.app!.screen.width / 2,
        y - this.app!.screen.height / 2
      )
      if (dist < 200) {
        this.setState('listening')
        setTimeout(() => this.setState('idle'), 2000) // Return to idle after a bit
      }
    }
  }
}

export default new AnimationService()
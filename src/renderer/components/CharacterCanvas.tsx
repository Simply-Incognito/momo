import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
// Our CSP forbids eval. Importing this shim replaces Pixi's eval-based shader
// and batch generation with an equivalent (it self-installs since Pixi 7.1).
import '@pixi/unsafe-eval'

export type BuddyState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'sleepy'

type Props = {
  state: BuddyState
  /** Cursor position in window coordinates, used for eye tracking. */
  cursor?: { x: number; y: number }
  /** 0..1 loudness of the voice while talking. */
  amplitude?: number
  size?: number
}

/** Colors the blob shifts through per mood. */
const MOOD_COLOR: Record<BuddyState, number> = {
  idle: 0xffc2dd,
  listening: 0xffa8c4,
  thinking: 0xcdb4f6,
  talking: 0xff8fa3,
  happy: 0xffb27a,
  sad: 0x9ec9f0,
  surprised: 0xffe08a,
  sleepy: 0xa9c8ee,
}

const lerpColor = (from: number, to: number, t: number): number => {
  const fr = (from >> 16) & 0xff
  const fg = (from >> 8) & 0xff
  const fb = from & 0xff
  const tr = (to >> 16) & 0xff
  const tg = (to >> 8) & 0xff
  const tb = to & 0xff
  const r = Math.round(fr + (tr - fr) * t)
  const g = Math.round(fg + (tg - fg) * t)
  const b = Math.round(fb + (tb - fb) * t)
  return (r << 16) | (g << 8) | b
}

/**
 * Draws and animates the "Puff" blob spirit.
 *
 * The whole character is vector-drawn with PixiJS Graphics: no sprite sheets,
 * so it stays crisp at any DPI and recolors per mood for free.
 */
export default function CharacterCanvas({ state, cursor, amplitude = 0, size = 240 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<BuddyState>(state)
  const cursorRef = useRef(cursor)
  const amplitudeRef = useRef(amplitude)

  stateRef.current = state
  cursorRef.current = cursor
  amplitudeRef.current = amplitude

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const app = new PIXI.Application({
      width: size,
      height: size,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    const canvas = app.view as unknown as HTMLCanvasElement
    canvas.style.display = 'block'
    host.appendChild(canvas)

    // ----- character construction -----
    const root = new PIXI.Container()
    root.position.set(size / 2, size / 2 + size * 0.04)
    app.stage.addChild(root)

    // Soft glow behind the body, brightest while listening/talking.
    const glow = new PIXI.Graphics()
    glow.beginFill(0xffc2dd, 0.35)
    glow.drawCircle(0, 0, size * 0.3)
    glow.endFill()
    glow.alpha = 0.15
    root.addChild(glow)

    // Body
    const body = new PIXI.Graphics()
    const bw = size * 0.3
    const bh = size * 0.34
    body.beginFill(0xffffff)
    body.drawEllipse(0, 0, bw, bh)
    body.endFill()
    body.tint = MOOD_COLOR.idle
    root.addChild(body)

    // Little highlight for a soft, squishy look
    const sheen = new PIXI.Graphics()
    sheen.beginFill(0xffffff, 0.45)
    sheen.drawEllipse(-bw * 0.32, -bh * 0.42, bw * 0.4, bh * 0.22)
    sheen.endFill()
    root.addChild(sheen)

    // Blush
    const blush = new PIXI.Graphics()
    blush.beginFill(0xff8fae, 0.35)
    blush.drawCircle(-bw * 0.62, bh * 0.28, size * 0.045)
    blush.drawCircle(bw * 0.62, bh * 0.28, size * 0.045)
    blush.endFill()
    root.addChild(blush)

    // Eye whites
    const eyeGap = size * 0.105
    const eyeY = -size * 0.05
    const eyeW = size * 0.075
    const eyeH = size * 0.095
    const eyes = new PIXI.Graphics()
    eyes.beginFill(0xffffff)
    eyes.drawEllipse(-eyeGap, eyeY, eyeW, eyeH)
    eyes.drawEllipse(eyeGap, eyeY, eyeW, eyeH)
    eyes.endFill()
    root.addChild(eyes)

    // Pupils
    const pupilW = size * 0.038
    const pupilH = size * 0.05
    const pupilL = new PIXI.Graphics()
    pupilL.beginFill(0x2c3e50)
    pupilL.drawEllipse(0, 0, pupilW, pupilH)
    pupilL.endFill()
    const pupilR = new PIXI.Graphics()
    pupilR.beginFill(0x2c3e50)
    pupilR.drawEllipse(0, 0, pupilW, pupilH)
    pupilR.endFill()
    pupilL.position.set(-eyeGap, eyeY)
    pupilR.position.set(eyeGap, eyeY)
    root.addChild(pupilL, pupilR)

    // Sparkles for happy/surprised
    const sparkles = new PIXI.Graphics()
    sparkles.beginFill(0xfff3b0)
    sparkles.drawCircle(0, 0, size * 0.02)
    sparkles.endFill()
    sparkles.alpha = 0
    root.addChild(sparkles)

    // Mouth (redrawn per frame so talking can open/close)
    const mouth = new PIXI.Graphics()
    root.addChild(mouth)

    // ----- animation state -----
    let time = 0
    let blinkIn = 2 + Math.random() * 3
    let blink = 0
    let eyeOpen = 1
    let currentColor = MOOD_COLOR.idle
    let wander = 0

    const drawMouth = (s: BuddyState, mouthOpen: number) => {
      mouth.clear()
      const mouthY = size * 0.11
      if (s === 'talking') {
        const h = size * 0.012 + mouthOpen * size * 0.05
        mouth.beginFill(0x8c3a56)
        mouth.drawEllipse(0, mouthY, size * 0.035, h)
        mouth.endFill()
        return
      }
      if (s === 'happy') {
        mouth.lineStyle(size * 0.012, 0x8c3a56)
        mouth.arc(0, mouthY - size * 0.02, size * 0.06, Math.PI * 0.15, Math.PI * 0.85)
        return
      }
      if (s === 'sad') {
        mouth.lineStyle(size * 0.009, 0x5b7b95)
        mouth.arc(0, mouthY + size * 0.03, size * 0.05, Math.PI * 1.15, Math.PI * 1.85)
        return
      }
      if (s === 'surprised') {
        mouth.beginFill(0x8c3a56)
        mouth.drawCircle(0, mouthY, size * 0.028)
        mouth.endFill()
        return
      }
      if (s === 'sleepy') {
        mouth.lineStyle(size * 0.008, 0x6b86a3)
        mouth.arc(0, mouthY, size * 0.03, 0, Math.PI)
        return
      }
      // idle / listening / thinking: gentle small smile
      mouth.lineStyle(size * 0.01, 0x8c3a56)
      mouth.arc(0, mouthY - size * 0.01, size * 0.035, Math.PI * 0.2, Math.PI * 0.8)
    }

    drawMouth('idle', 0)

    app.ticker.add((delta) => {
      const dt = delta / 60
      time += dt
      const s = stateRef.current

      // Color easing toward mood color
      currentColor = lerpColor(currentColor, MOOD_COLOR[s], Math.min(1, dt * 4))
      body.tint = currentColor
      glow.tint = currentColor

      // Breathing
      const breath = 1 + Math.sin(time * 1.7) * 0.018
      const squash = s === 'talking' ? 1 + Math.sin(time * 12) * 0.015 : 1
      body.scale.set(breath * squash, breath / squash)
      sheen.scale.copyFrom(body.scale)
      body.y = Math.sin(time * 1.7) * size * 0.006

      // Idle wander (a few px, very slow)
      wander += dt
      root.x = size / 2 + Math.sin(wander * 0.35) * size * 0.012
      root.y = size / 2 + size * 0.04 + Math.sin(time * 0.7) * size * 0.004

      // State-driven posture
      const posture: Partial<Record<BuddyState, { scale: number; rot: number; glow: number }>> = {
        idle: { scale: 1, rot: 0, glow: 0.12 },
        listening: { scale: 1.05, rot: 0, glow: 0.32 },
        thinking: { scale: 1, rot: Math.sin(time * 2) * 0.05, glow: 0.18 },
        talking: { scale: 1.04, rot: 0, glow: 0.38 },
        happy: { scale: 1.06, rot: Math.sin(time * 3) * 0.03, glow: 0.3 },
        sad: { scale: 0.97, rot: 0, glow: 0.08 },
        surprised: { scale: 1.1, rot: 0, glow: 0.4 },
        sleepy: { scale: 0.95, rot: 0, glow: 0.06 },
      }
      const p = posture[s] ?? posture.idle!
      root.scale.set(
        root.scale.x + (p.scale - root.scale.x) * Math.min(1, dt * 6),
        root.scale.y + (p.scale - root.scale.y) * Math.min(1, dt * 6),
      )
      root.rotation += (p.rot - root.rotation) * Math.min(1, dt * 4)
      glow.alpha += (p.glow - glow.alpha) * Math.min(1, dt * 3)

      // Eye openness per state (smoothed), then multiplies the blink factor.
      const eyeTarget =
        s === 'listening' || s === 'surprised' ? 1.18 : s === 'sleepy' ? 0.55 : s === 'sad' ? 0.9 : 1
      eyeOpen += (eyeTarget - eyeOpen) * Math.min(1, dt * 8)

      // Blinking
      blinkIn -= dt
      if (blinkIn <= 0) {
        blink = 1
        blinkIn = 2.5 + Math.random() * 3.5
      }
      if (blink > 0) blink = Math.max(0, blink - dt * 7)
      const blinkScale = 1 - blink * 0.92

      // Pupil tracking / wander
      const c = cursorRef.current
      let px = Math.sin(time * 0.9) * eyeW * 0.35
      let py = Math.cos(time * 1.3) * eyeH * 0.2
      if (c) {
        const dx = c.x - size / 2
        const dy = c.y - (size / 2 + size * 0.04)
        const len = Math.hypot(dx, dy) || 1
        px = (dx / len) * eyeW * 0.4
        py = (dy / len) * eyeH * 0.3
      }
      const eyeShut = Math.max(0.08, eyeOpen * blinkScale)
      pupilL.position.set(-eyeGap + px, eyeY + py)
      pupilR.position.set(eyeGap + px, eyeY + py)
      eyes.scale.y = eyeShut
      pupilL.scale.y = pupilR.scale.y = blinkScale

      // Mouth for talking follows amplitude
      if (s === 'talking') {
        drawMouth('talking', Math.min(1, amplitudeRef.current + Math.abs(Math.sin(time * 14)) * 0.25))
      } else {
        drawMouth(s, 0)
      }

      // Sparkles
      const wantSparkle = s === 'happy' || s === 'surprised' ? 1 : 0
      sparkles.alpha += (wantSparkle - sparkles.alpha) * Math.min(1, dt * 5)
      sparkles.position.set(Math.sin(time * 5) * bw * 0.9, -bh * 0.9 + Math.cos(time * 4) * 6)
    })

    return () => {
      app.destroy(true, { children: true })
    }
  }, [size])

  return <div ref={hostRef} style={{ width: size, height: size }} />
}

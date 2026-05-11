import { useRef, useEffect, useCallback } from 'react'

export type PetAnim = 'IDLE' | 'THINKING' | 'TALKING' | 'HAPPY' | 'SLEEPING' | 'WAVING'

interface Props {
  anim: PetAnim
  size?: number
}

// ── Colour palette ────────────────────────────────────────────────────────
const C = {
  body:    '#FF7043',
  shadow:  '#E64A19',
  belly:   '#FFCCBC',
  eye:     '#3E2723',
  pupil:   '#FFFFFF',
  blush:   'rgba(255,105,97,0.35)',
  mouth:   '#BF360C',
  ear:     '#FF8A65',
  dot:     '#FF7043',
  zzz:     '#7986CB',
  sparkle: '#FFD700',
}

export default function PetCanvas({ anim, size = 164 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const t0Ref     = useRef<number>(performance.now())
  // blink state
  const blinkRef  = useRef({ next: 3.0, open: true, prog: 0 })
  // waving arm angle
  const waveRef   = useRef(0)

  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const t   = (ts - t0Ref.current) / 1000  // seconds since mount

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // ── Layout constants ─────────────────────────────────────────────────
    const S     = size / 164          // scale factor
    const cx    = canvas.width  * 0.5
    const baseY = canvas.height * 0.78

    // ── Motion offsets ───────────────────────────────────────────────────
    let bobY = 0, scaleX = 1, scaleY = 1

    if (anim === 'IDLE') {
      bobY = Math.sin(t * 1.8) * 3 * S
    } else if (anim === 'HAPPY') {
      bobY   = Math.sin(t * 4)   * 7 * S
      scaleX = 1 + Math.sin(t * 8) * 0.04
      scaleY = 1 - Math.sin(t * 8) * 0.04
    } else if (anim === 'SLEEPING') {
      bobY = Math.sin(t * 0.6) * 2 * S
    } else if (anim === 'WAVING') {
      bobY   = Math.sin(t * 2) * 3 * S
    }

    // ── Blink logic ──────────────────────────────────────────────────────
    const blink = blinkRef.current
    if (anim !== 'SLEEPING') {
      if (t > blink.next) {
        blink.open = false
        blink.prog = 0
      }
      if (!blink.open) {
        blink.prog += 0.12
        if (blink.prog >= 1) {
          blink.open = true
          blink.next = t + 2.5 + Math.random() * 2.5
        }
      }
    }
    const eyeOpen = anim === 'SLEEPING' ? 0 : (blink.open ? 1 : 1 - Math.sin(blink.prog * Math.PI))

    // ── Pet origin ───────────────────────────────────────────────────────
    const py = baseY + bobY

    ctx.save()
    ctx.translate(cx, py)
    ctx.scale(scaleX, scaleY)

    // ── Drop shadow ───────────────────────────────────────────────────────
    ctx.save()
    ctx.scale(1, 0.25)
    ctx.beginPath()
    ctx.ellipse(0, 58 * S, 38 * S, 12 * S, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fill()
    ctx.restore()

    // ── Ears ─────────────────────────────────────────────────────────────
    drawEar(ctx, -26 * S, -60 * S, S, false)
    drawEar(ctx,  26 * S, -60 * S, S, true)

    // ── Body ──────────────────────────────────────────────────────────────
    ctx.beginPath()
    // blob shape using bezier curves
    ctx.moveTo(0, -68 * S)
    ctx.bezierCurveTo( 40 * S, -68 * S,  50 * S, -40 * S,  50 * S,   0)
    ctx.bezierCurveTo( 50 * S,  40 * S,  32 * S,  58 * S,   0,  58 * S)
    ctx.bezierCurveTo(-32 * S,  58 * S, -50 * S,  40 * S, -50 * S,   0)
    ctx.bezierCurveTo(-50 * S, -40 * S, -40 * S, -68 * S,   0, -68 * S)
    ctx.closePath()
    ctx.fillStyle = C.body
    ctx.fill()

    // body rim shading
    ctx.beginPath()
    ctx.moveTo(0, -68 * S)
    ctx.bezierCurveTo( 40 * S, -68 * S,  50 * S, -40 * S,  50 * S, 0)
    ctx.bezierCurveTo( 50 * S,  40 * S,  32 * S,  58 * S,   0,  58 * S)
    ctx.bezierCurveTo(-32 * S,  58 * S, -50 * S,  40 * S, -50 * S, 0)
    ctx.bezierCurveTo(-50 * S, -40 * S, -40 * S, -68 * S,   0, -68 * S)
    ctx.closePath()
    const grad = ctx.createRadialGradient(-12 * S, -30 * S, 0, 0, 0, 60 * S)
    grad.addColorStop(0, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(0,0,0,0.08)')
    ctx.fillStyle = grad
    ctx.fill()

    // ── Belly spot ────────────────────────────────────────────────────────
    ctx.beginPath()
    ctx.ellipse(0, 18 * S, 22 * S, 26 * S, 0, 0, Math.PI * 2)
    ctx.fillStyle = C.belly
    ctx.fill()

    // ── Left arm ─────────────────────────────────────────────────────────
    ctx.save()
    ctx.translate(-48 * S, 10 * S)
    ctx.rotate(0.3 + Math.sin(t * 1.8) * 0.08)
    drawArm(ctx, S, false)
    ctx.restore()

    // ── Right arm (waving when in WAVING state) ───────────────────────────
    ctx.save()
    ctx.translate(48 * S, 10 * S)
    if (anim === 'WAVING') {
      waveRef.current = Math.sin(t * 5) * 0.5 - 0.8
      ctx.rotate(waveRef.current)
    } else {
      ctx.rotate(-0.3 - Math.sin(t * 1.8 + 1) * 0.08)
    }
    drawArm(ctx, S, true)
    ctx.restore()

    // ── Eyes ──────────────────────────────────────────────────────────────
    drawEye(ctx, -18 * S, -28 * S, S, eyeOpen, anim)
    drawEye(ctx,  18 * S, -28 * S, S, eyeOpen, anim)

    // ── Blush ─────────────────────────────────────────────────────────────
    if (anim !== 'SLEEPING') {
      ctx.beginPath()
      ctx.ellipse(-32 * S, -14 * S, 10 * S, 7 * S, -0.2, 0, Math.PI * 2)
      ctx.fillStyle = C.blush
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse( 32 * S, -14 * S, 10 * S, 7 * S,  0.2, 0, Math.PI * 2)
      ctx.fillStyle = C.blush
      ctx.fill()
    }

    // ── Mouth ─────────────────────────────────────────────────────────────
    drawMouth(ctx, S, t, anim)

    ctx.restore()  // end pet transform

    // ── Overlay effects ───────────────────────────────────────────────────
    if (anim === 'THINKING') {
      drawThinkingDots(ctx, cx, py - 80 * S, S, t)
    } else if (anim === 'SLEEPING') {
      drawZzz(ctx, cx + 36 * S, py - 72 * S, S, t)
    } else if (anim === 'HAPPY') {
      drawSparkles(ctx, cx, py, S, t)
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [anim, size])

  useEffect(() => {
    t0Ref.current = performance.now()
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  )
}

// ── Sub-drawing functions ─────────────────────────────────────────────────

function drawEar(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, right: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(right ? 0.3 : -0.3)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-8 * S, -18 * S, -4 * S, -28 * S, 0, -24 * S)
  ctx.bezierCurveTo( 4 * S, -28 * S,  8 * S, -18 * S, 0, 0)
  ctx.closePath()
  ctx.fillStyle = C.ear
  ctx.fill()
  ctx.restore()
}

function drawArm(ctx: CanvasRenderingContext2D, S: number, right: boolean) {
  ctx.beginPath()
  ctx.ellipse(0, 0, 10 * S, 16 * S, right ? 0.3 : -0.3, 0, Math.PI * 2)
  ctx.fillStyle = C.body
  ctx.fill()
  // hand
  ctx.beginPath()
  ctx.ellipse(right ? 5 * S : -5 * S, 14 * S, 8 * S, 7 * S, 0, 0, Math.PI * 2)
  ctx.fillStyle = C.shadow
  ctx.fill()
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  S: number,
  openness: number,
  anim: PetAnim
) {
  ctx.save()
  ctx.translate(x, y)

  // white sclera
  ctx.beginPath()
  ctx.ellipse(0, 0, 10 * S, 10 * S * openness + 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  if (openness > 0.3 && anim !== 'SLEEPING') {
    // iris
    ctx.beginPath()
    ctx.ellipse(1.5 * S, 1 * S, 6 * S * openness, 6 * S * openness, 0, 0, Math.PI * 2)
    ctx.fillStyle = C.eye
    ctx.fill()
    // highlight
    ctx.beginPath()
    ctx.ellipse(3 * S, -2 * S, 2 * S, 2 * S, 0, 0, Math.PI * 2)
    ctx.fillStyle = C.pupil
    ctx.fill()
  }

  if (anim === 'SLEEPING') {
    // closed curve
    ctx.beginPath()
    ctx.arc(0, 0, 8 * S, Math.PI, 0, false)
    ctx.strokeStyle = C.eye
    ctx.lineWidth = 2 * S
    ctx.stroke()
  }

  ctx.restore()
}

function drawMouth(ctx: CanvasRenderingContext2D, S: number, t: number, anim: PetAnim) {
  ctx.save()
  ctx.translate(0, 10 * S)

  if (anim === 'TALKING') {
    const open = (Math.sin(t * 10) * 0.5 + 0.5) * 8 * S + 2 * S
    ctx.beginPath()
    ctx.ellipse(0, 0, 10 * S, open, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#BF360C'
    ctx.fill()
    // teeth hint
    ctx.beginPath()
    ctx.ellipse(0, -open * 0.3, 8 * S, open * 0.3, 0, 0, Math.PI)
    ctx.fillStyle = '#FFF'
    ctx.fill()
  } else if (anim === 'HAPPY') {
    ctx.beginPath()
    ctx.moveTo(-14 * S, -2 * S)
    ctx.quadraticCurveTo(0, 12 * S, 14 * S, -2 * S)
    ctx.strokeStyle = C.mouth
    ctx.lineWidth = 3 * S
    ctx.lineCap = 'round'
    ctx.stroke()
  } else if (anim === 'SLEEPING' || anim === 'THINKING') {
    ctx.beginPath()
    ctx.moveTo(-10 * S, 0)
    ctx.lineTo(10 * S, 0)
    ctx.strokeStyle = C.mouth
    ctx.lineWidth = 2.5 * S
    ctx.lineCap = 'round'
    ctx.stroke()
  } else {
    // neutral small smile
    ctx.beginPath()
    ctx.moveTo(-10 * S, 0)
    ctx.quadraticCurveTo(0, 6 * S, 10 * S, 0)
    ctx.strokeStyle = C.mouth
    ctx.lineWidth = 2.5 * S
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  ctx.restore()
}

function drawThinkingDots(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  S: number, t: number
) {
  for (let i = 0; i < 3; i++) {
    const dy = Math.sin(t * 3 + (i * Math.PI * 2) / 3) * 5 * S
    ctx.beginPath()
    ctx.arc(x - 12 * S + i * 12 * S, y + dy, 5 * S, 0, Math.PI * 2)
    ctx.fillStyle = C.dot
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawZzz(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  S: number, t: number
) {
  const letters = ['z', 'z', 'Z']
  letters.forEach((z, i) => {
    const floatY = ((t * 0.6 + i * 0.5) % 1) * -24 * S
    const alpha  = 1 - ((t * 0.6 + i * 0.5) % 1) * 0.7
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle   = C.zzz
    ctx.font = `bold ${(11 + i * 3) * S}px sans-serif`
    ctx.fillText(z, x + i * 10 * S, y + floatY)
    ctx.restore()
  })
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  S: number, t: number
) {
  for (let i = 0; i < 5; i++) {
    const angle  = t * 1.5 + (i * Math.PI * 2) / 5
    const radius = 55 * S + Math.sin(t * 3 + i) * 8 * S
    const sx     = cx + Math.cos(angle) * radius
    const sy     = cy - 20 * S + Math.sin(angle) * radius * 0.6
    const size   = (4 + Math.sin(t * 4 + i) * 2) * S

    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(t * 2 + i)
    // 4-point star
    ctx.beginPath()
    for (let p = 0; p < 8; p++) {
      const r = p % 2 === 0 ? size : size * 0.4
      const a = (p * Math.PI) / 4
      p === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
              : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? C.sparkle : '#FF80AB'
    ctx.fill()
    ctx.restore()
  }
}

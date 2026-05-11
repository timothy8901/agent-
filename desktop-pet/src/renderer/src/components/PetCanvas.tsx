import { useRef, useEffect, useCallback } from 'react'

export type PetAnim = 'IDLE' | 'THINKING' | 'TALKING' | 'HAPPY' | 'SLEEPING' | 'WAVING'

export interface PetAppearance {
  colorIndex: number  // 0-4
  faceIndex:  number  // 0-4
  earIndex:   number  // 0-4
}

interface Props {
  anim:       PetAnim
  appearance: PetAppearance
  size?:      number
}

// ── Colour palettes (body, belly, ear, eye, mouth, blush, shadow) ──────────
const PALETTES = [
  { body: '#FF7043', belly: '#FFCCBC', ear: '#FF8A65', eye: '#3E2723', mouth: '#BF360C', blush: 'rgba(255,105,97,0.35)', shadow: '#E64A19' },
  { body: '#42A5F5', belly: '#E3F2FD', ear: '#64B5F6', eye: '#0D47A1', mouth: '#1565C0', blush: 'rgba(66,165,245,0.30)', shadow: '#1E88E5' },
  { body: '#66BB6A', belly: '#E8F5E9', ear: '#81C784', eye: '#1B5E20', mouth: '#2E7D32', blush: 'rgba(102,187,106,0.30)', shadow: '#43A047' },
  { body: '#AB47BC', belly: '#F3E5F5', ear: '#BA68C8', eye: '#4A148C', mouth: '#6A1B9A', blush: 'rgba(171,71,188,0.30)', shadow: '#8E24AA' },
  { body: '#EC407A', belly: '#FCE4EC', ear: '#F06292', eye: '#880E4F', mouth: '#AD1457', blush: 'rgba(236,64,122,0.30)', shadow: '#D81B60' },
]

export default function PetCanvas({ anim, appearance, size = 164 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const t0Ref     = useRef<number>(performance.now())
  const blinkRef  = useRef({ next: 3.0, open: true, prog: 0 })
  const waveRef   = useRef(0)

  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const t   = (ts - t0Ref.current) / 1000
    const pal = PALETTES[appearance.colorIndex] ?? PALETTES[0]

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const S     = size / 164
    const cx    = canvas.width  * 0.5
    const baseY = canvas.height * 0.78

    // Motion offsets
    let bobY = 0, scaleX = 1, scaleY = 1
    if (anim === 'IDLE') {
      bobY = Math.sin(t * 1.8) * 3 * S
    } else if (anim === 'HAPPY') {
      bobY   = Math.sin(t * 4) * 7 * S
      scaleX = 1 + Math.sin(t * 8) * 0.04
      scaleY = 1 - Math.sin(t * 8) * 0.04
    } else if (anim === 'SLEEPING') {
      bobY = Math.sin(t * 0.6) * 2 * S
    } else if (anim === 'WAVING') {
      bobY = Math.sin(t * 2) * 3 * S
    }

    // Blink
    const blink = blinkRef.current
    if (anim !== 'SLEEPING') {
      if (t > blink.next) blink.open = false, blink.prog = 0
      if (!blink.open) {
        blink.prog += 0.12
        if (blink.prog >= 1) { blink.open = true; blink.next = t + 2.5 + Math.random() * 2.5 }
      }
    }
    const eyeOpen = anim === 'SLEEPING' ? 0 : (blink.open ? 1 : 1 - Math.sin(blink.prog * Math.PI))

    const py = baseY + bobY

    ctx.save()
    ctx.translate(cx, py)
    ctx.scale(scaleX, scaleY)

    // Shadow
    ctx.save()
    ctx.scale(1, 0.25)
    ctx.beginPath()
    ctx.ellipse(0, 58 * S, 38 * S, 12 * S, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fill()
    ctx.restore()

    // Ears
    drawEars(ctx, appearance.earIndex, S, pal, t, anim)

    // Body blob
    ctx.beginPath()
    ctx.moveTo(0, -68 * S)
    ctx.bezierCurveTo( 40 * S, -68 * S,  50 * S, -40 * S,  50 * S,   0)
    ctx.bezierCurveTo( 50 * S,  40 * S,  32 * S,  58 * S,   0,  58 * S)
    ctx.bezierCurveTo(-32 * S,  58 * S, -50 * S,  40 * S, -50 * S,   0)
    ctx.bezierCurveTo(-50 * S, -40 * S, -40 * S, -68 * S,   0, -68 * S)
    ctx.closePath()
    ctx.fillStyle = pal.body
    ctx.fill()

    // Sheen
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

    // Belly
    ctx.beginPath()
    ctx.ellipse(0, 18 * S, 22 * S, 26 * S, 0, 0, Math.PI * 2)
    ctx.fillStyle = pal.belly
    ctx.fill()

    // Arms
    ctx.save()
    ctx.translate(-48 * S, 10 * S)
    ctx.rotate(0.3 + Math.sin(t * 1.8) * 0.08)
    drawArm(ctx, S, false, pal.body, pal.shadow)
    ctx.restore()

    ctx.save()
    ctx.translate(48 * S, 10 * S)
    if (anim === 'WAVING') {
      waveRef.current = Math.sin(t * 5) * 0.5 - 0.8
      ctx.rotate(waveRef.current)
    } else {
      ctx.rotate(-0.3 - Math.sin(t * 1.8 + 1) * 0.08)
    }
    drawArm(ctx, S, true, pal.body, pal.shadow)
    ctx.restore()

    // Eyes
    drawEyes(ctx, appearance.faceIndex, S, eyeOpen, anim, pal, t)

    // Blush
    if (anim !== 'SLEEPING') {
      ctx.beginPath()
      ctx.ellipse(-32 * S, -14 * S, 10 * S, 7 * S, -0.2, 0, Math.PI * 2)
      ctx.fillStyle = pal.blush
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse( 32 * S, -14 * S, 10 * S, 7 * S,  0.2, 0, Math.PI * 2)
      ctx.fillStyle = pal.blush
      ctx.fill()
    }

    // Mouth
    drawMouth(ctx, S, t, anim, pal.mouth)

    ctx.restore()

    // Overlays
    if (anim === 'THINKING') drawThinkingDots(ctx, cx, py - 80 * S, S, t, pal.body)
    else if (anim === 'SLEEPING') drawZzz(ctx, cx + 36 * S, py - 72 * S, S, t)
    else if (anim === 'HAPPY') drawSparkles(ctx, cx, py, S, t, pal.body)

    rafRef.current = requestAnimationFrame(draw)
  }, [anim, appearance, size])

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

// ── Ear styles ────────────────────────────────────────────────────────────
function drawEars(
  ctx: CanvasRenderingContext2D,
  earIndex: number, S: number,
  pal: typeof PALETTES[0], t: number, anim: PetAnim
) {
  switch (earIndex) {
    case 0: // Teardrop (original)
      drawTeardropEar(ctx, -26 * S, -60 * S, S, false, pal.ear)
      drawTeardropEar(ctx,  26 * S, -60 * S, S, true,  pal.ear)
      break
    case 1: // Cat ears
      drawCatEar(ctx, -28 * S, -62 * S, S, false, pal.ear, pal.belly)
      drawCatEar(ctx,  28 * S, -62 * S, S, true,  pal.ear, pal.belly)
      break
    case 2: // Bunny ears
      const wiggle = anim === 'HAPPY' ? Math.sin(t * 5) * 0.06 : 0
      drawBunnyEar(ctx, -24 * S, -62 * S, S, -0.15 + wiggle, pal.ear, pal.belly)
      drawBunnyEar(ctx,  24 * S, -62 * S, S,  0.15 - wiggle, pal.ear, pal.belly)
      break
    case 3: // Round ears
      drawRoundEar(ctx, -36 * S, -56 * S, S, pal.ear, pal.belly)
      drawRoundEar(ctx,  36 * S, -56 * S, S, pal.ear, pal.belly)
      break
    case 4: // Devil horns
      drawHorn(ctx, -24 * S, -62 * S, S, false, pal.ear)
      drawHorn(ctx,  24 * S, -62 * S, S, true,  pal.ear)
      break
  }
}

function drawTeardropEar(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, right: boolean, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(right ? 0.3 : -0.3)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-8 * S, -18 * S, -4 * S, -28 * S, 0, -24 * S)
  ctx.bezierCurveTo( 4 * S, -28 * S,  8 * S, -18 * S, 0,   0)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function drawCatEar(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, right: boolean, outer: string, inner: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(right ? 0.2 : -0.2)
  // outer triangle
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(right ? 14 * S : -14 * S, -26 * S)
  ctx.lineTo(right ? -4 * S :  4 * S, -26 * S)
  ctx.closePath()
  ctx.fillStyle = outer
  ctx.fill()
  // inner triangle
  ctx.beginPath()
  ctx.moveTo(0, -4 * S)
  ctx.lineTo(right ? 9 * S : -9 * S, -22 * S)
  ctx.lineTo(right ? -1 * S :  1 * S, -22 * S)
  ctx.closePath()
  ctx.fillStyle = inner
  ctx.fill()
  ctx.restore()
}

function drawBunnyEar(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, angle: number, outer: string, inner: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(0, -18 * S, 7 * S, 22 * S, 0, 0, Math.PI * 2)
  ctx.fillStyle = outer
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, -18 * S, 4 * S, 15 * S, 0, 0, Math.PI * 2)
  ctx.fillStyle = inner
  ctx.fill()
  ctx.restore()
}

function drawRoundEar(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, outer: string, inner: string) {
  ctx.beginPath()
  ctx.arc(x, y, 13 * S, 0, Math.PI * 2)
  ctx.fillStyle = outer
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, 8 * S, 0, Math.PI * 2)
  ctx.fillStyle = inner
  ctx.fill()
}

function drawHorn(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, right: boolean, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(right ? 0.15 : -0.15)
  ctx.beginPath()
  ctx.moveTo(-6 * S, 0)
  ctx.quadraticCurveTo(right ? 10 * S : -10 * S, -14 * S, 0, -28 * S)
  ctx.quadraticCurveTo(right ? -2 * S :  2 * S, -14 * S, 6 * S, 0)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

// ── Arm ───────────────────────────────────────────────────────────────────
function drawArm(ctx: CanvasRenderingContext2D, S: number, right: boolean, body: string, shadow: string) {
  ctx.beginPath()
  ctx.ellipse(0, 0, 10 * S, 16 * S, right ? 0.3 : -0.3, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(right ? 5 * S : -5 * S, 14 * S, 8 * S, 7 * S, 0, 0, Math.PI * 2)
  ctx.fillStyle = shadow
  ctx.fill()
}

// ── Face styles ───────────────────────────────────────────────────────────
function drawEyes(
  ctx: CanvasRenderingContext2D,
  faceIndex: number, S: number, openness: number,
  anim: PetAnim, pal: typeof PALETTES[0], t: number
) {
  const eyePositions: [number, number][] = [[-18 * S, -28 * S], [18 * S, -28 * S]]

  if (anim === 'DEAD') {
    eyePositions.forEach(([ex, ey]) => {
      ctx.save(); ctx.translate(ex, ey)
      ctx.strokeStyle = pal.eye; ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(-7*S,-7*S); ctx.lineTo(7*S,7*S); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(7*S,-7*S);  ctx.lineTo(-7*S,7*S); ctx.stroke()
      ctx.restore()
    })
    return
  }

  if (anim === 'SLEEPING' || openness < 0.1) {
    eyePositions.forEach(([ex, ey]) => {
      ctx.save(); ctx.translate(ex, ey)
      ctx.beginPath()
      ctx.arc(0, 0, 9 * S, Math.PI, 0, false)
      ctx.strokeStyle = pal.eye; ctx.lineWidth = 2.5 * S
      ctx.stroke()
      ctx.restore()
    })
    return
  }

  switch (faceIndex) {
    case 0: // Classic round eyes
      eyePositions.forEach(([ex, ey]) => {
        ctx.save(); ctx.translate(ex, ey)
        ctx.beginPath(); ctx.ellipse(0, 0, 10*S, 10*S*openness + 0.5, 0, 0, Math.PI*2)
        ctx.fillStyle = '#FFF'; ctx.fill()
        if (openness > 0.3) {
          ctx.beginPath(); ctx.ellipse(1.5*S, 1*S, 6*S*openness, 6*S*openness, 0, 0, Math.PI*2)
          ctx.fillStyle = pal.eye; ctx.fill()
          ctx.beginPath(); ctx.ellipse(3*S, -2*S, 2*S, 2*S, 0, 0, Math.PI*2)
          ctx.fillStyle = '#FFF'; ctx.fill()
        }
        ctx.restore()
      })
      break

    case 1: // Happy squint - always curved upward
      eyePositions.forEach(([ex, ey]) => {
        ctx.save(); ctx.translate(ex, ey)
        ctx.beginPath()
        ctx.arc(0, 3*S, 9*S, Math.PI + 0.2, -0.2, false)
        ctx.strokeStyle = pal.eye; ctx.lineWidth = 3*S; ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()
      })
      break

    case 2: // Cool half-lidded
      eyePositions.forEach(([ex, ey]) => {
        ctx.save(); ctx.translate(ex, ey)
        // white sclera
        ctx.beginPath(); ctx.ellipse(0, 0, 10*S, 10*S*openness + 0.5, 0, 0, Math.PI*2)
        ctx.fillStyle = '#FFF'; ctx.fill()
        // pupil
        ctx.beginPath(); ctx.ellipse(1*S, 2*S, 6*S, 6*S*openness, 0, 0, Math.PI*2)
        ctx.fillStyle = pal.eye; ctx.fill()
        // heavy eyelid
        ctx.beginPath()
        ctx.rect(-12*S, -12*S, 24*S, 10*S)
        ctx.fillStyle = pal.body; ctx.fill()
        ctx.restore()
      })
      break

    case 3: // Starry eyes
      eyePositions.forEach(([ex, ey]) => {
        ctx.save(); ctx.translate(ex, ey)
        ctx.beginPath(); ctx.ellipse(0, 0, 10*S, 10*S*openness + 0.5, 0, 0, Math.PI*2)
        ctx.fillStyle = '#FFF'; ctx.fill()
        if (openness > 0.3) {
          // star pupil
          const spin = t * 0.8
          ctx.save(); ctx.rotate(spin)
          ctx.fillStyle = pal.eye
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2
            ctx.beginPath()
            ctx.ellipse(Math.cos(a)*3*S*openness, Math.sin(a)*3*S*openness, 3*S, 1.5*S, a, 0, Math.PI*2)
            ctx.fill()
          }
          ctx.restore()
          ctx.beginPath(); ctx.arc(0, 0, 2.5*S, 0, Math.PI*2)
          ctx.fillStyle = pal.eye; ctx.fill()
        }
        ctx.restore()
      })
      break

    case 4: // Minimalist dots
      eyePositions.forEach(([ex, ey]) => {
        ctx.save(); ctx.translate(ex, ey)
        ctx.beginPath()
        ctx.ellipse(0, 0, 4*S, 4*S*openness + 0.5, 0, 0, Math.PI*2)
        ctx.fillStyle = pal.eye; ctx.fill()
        ctx.restore()
      })
      break
  }
}

// ── Mouth ─────────────────────────────────────────────────────────────────
function drawMouth(ctx: CanvasRenderingContext2D, S: number, t: number, anim: PetAnim, color: string) {
  ctx.save()
  ctx.translate(0, 10 * S)
  if (anim === 'TALKING') {
    const open = (Math.sin(t * 10) * 0.5 + 0.5) * 8 * S + 2 * S
    ctx.beginPath(); ctx.ellipse(0, 0, 10*S, open, 0, 0, Math.PI*2)
    ctx.fillStyle = color; ctx.fill()
    ctx.beginPath(); ctx.ellipse(0, -open*0.3, 8*S, open*0.3, 0, 0, Math.PI)
    ctx.fillStyle = '#FFF'; ctx.fill()
  } else if (anim === 'HAPPY') {
    ctx.beginPath(); ctx.moveTo(-14*S, -2*S)
    ctx.quadraticCurveTo(0, 12*S, 14*S, -2*S)
    ctx.strokeStyle = color; ctx.lineWidth = 3*S; ctx.lineCap = 'round'; ctx.stroke()
  } else if (anim === 'SLEEPING' || anim === 'THINKING') {
    ctx.beginPath(); ctx.moveTo(-10*S, 0); ctx.lineTo(10*S, 0)
    ctx.strokeStyle = color; ctx.lineWidth = 2.5*S; ctx.lineCap = 'round'; ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-10*S, 0)
    ctx.quadraticCurveTo(0, 6*S, 10*S, 0)
    ctx.strokeStyle = color; ctx.lineWidth = 2.5*S; ctx.lineCap = 'round'; ctx.stroke()
  }
  ctx.restore()
}

// ── Overlays ──────────────────────────────────────────────────────────────
function drawThinkingDots(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, color: string) {
  for (let i = 0; i < 3; i++) {
    const dy = Math.sin(t * 3 + (i * Math.PI * 2) / 3) * 5 * S
    ctx.beginPath(); ctx.arc(x - 12*S + i*12*S, y + dy, 5*S, 0, Math.PI*2)
    ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1
  }
}

function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number) {
  ['z','z','Z'].forEach((z, i) => {
    const floatY = ((t * 0.6 + i * 0.5) % 1) * -24 * S
    const alpha  = 1 - ((t * 0.6 + i * 0.5) % 1) * 0.7
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#7986CB'
    ctx.font = `bold ${(11 + i * 3) * S}px sans-serif`
    ctx.fillText(z, x + i * 10 * S, y + floatY)
    ctx.restore()
  })
}

function drawSparkles(ctx: CanvasRenderingContext2D, cx: number, cy: number, S: number, t: number, color: string) {
  for (let i = 0; i < 5; i++) {
    const angle  = t * 1.5 + (i * Math.PI * 2) / 5
    const radius = 55 * S + Math.sin(t * 3 + i) * 8 * S
    const sx     = cx + Math.cos(angle) * radius
    const sy     = cy - 20*S + Math.sin(angle) * radius * 0.6
    const sz     = (4 + Math.sin(t * 4 + i) * 2) * S
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 2 + i)
    ctx.beginPath()
    for (let p = 0; p < 8; p++) {
      const r = p % 2 === 0 ? sz : sz * 0.4
      const a = (p * Math.PI) / 4
      p === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
    }
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? '#FFD700' : color; ctx.fill()
    ctx.restore()
  }
}

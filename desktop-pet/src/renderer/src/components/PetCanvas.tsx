import { useRef, useEffect } from 'react'

export type PetAnim = 'IDLE' | 'WAVING' | 'HAPPY' | 'TALKING' | 'SLEEPING' | 'THINKING' | 'EATING'

export interface PetAppearance {
  colorIndex: number
  faceIndex:  number
  earIndex:   number
}

// ── Colour palettes ───────────────────────────────────────────────────────
const PALETTES = [
  { body: '#FF7043', shadow: '#BF360C', glow: 'rgba(255,112,67,0.40)' },
  { body: '#42A5F5', shadow: '#0D47A1', glow: 'rgba(66,165,245,0.40)'  },
  { body: '#66BB6A', shadow: '#1B5E20', glow: 'rgba(102,187,106,0.40)' },
  { body: '#AB47BC', shadow: '#4A148C', glow: 'rgba(171,71,188,0.40)'  },
  { body: '#EC407A', shadow: '#880E4F', glow: 'rgba(236,64,122,0.40)'  },
]

// ── 11 × 8 pixel grid — classic Space-Invaders crab ───────────────────────
const PW = 11
const PH = 8

// Antenna styles (rows 0–1, indexed by earIndex)
const ANTENNAS: number[][][] = [
  [[0,0,1,0,0,0,0,0,1,0,0],[0,0,0,1,0,0,0,1,0,0,0]], // Teardrop
  [[0,1,1,0,0,0,0,0,1,1,0],[0,0,1,0,0,0,0,0,1,0,0]], // Cat
  [[0,0,1,0,0,0,0,0,1,0,0],[0,0,1,0,0,0,0,0,1,0,0]], // Bunny
  [[0,0,0,1,0,0,0,1,0,0,0],[0,0,1,1,0,0,0,1,1,0,0]], // Round
  [[1,0,1,0,0,0,0,0,1,0,1],[0,1,0,0,0,0,0,0,0,1,0]], // Horns
]

// Eye row variants (row 3, indexed by faceIndex)
const EYE_ROWS: number[][] = [
  [1,1,0,1,1,1,1,1,0,1,1], // Classic
  [1,1,1,0,1,1,1,0,1,1,1], // Happy squint
  [1,1,0,0,1,1,1,0,0,1,1], // Cool wide
  [1,0,1,0,1,1,1,0,1,0,1], // Starry
  [1,1,1,0,1,1,1,0,1,1,1], // Dot
]

// ── Body frames ───────────────────────────────────────────────────────────
// Rows 0–1 = placeholder (overwritten by antenna)
// Row 3    = placeholder (overwritten by eye)
const BODY_A: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0], // eye placeholder
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,1,0,0,0,1,0,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
]
const BODY_B: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,1,0,0,0,1,0,0,0], // legs alternate
  [1,0,1,0,0,0,0,0,1,0,1], // feet spread
]
const BODY_HAPPY: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [1,0,1,1,1,1,1,1,1,0,1], // arms raised
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,0,1,0,1,0,1,1,0], // smile
  [1,0,1,0,0,0,0,0,1,0,1],
]
const BODY_SLEEPING: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1], // closed eyes — full row
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0],
]
const BODY_TALKING_OPEN: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,0,1,1,1,0,1,1,0], // mouth open
  [0,1,0,1,0,0,0,1,0,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
]
const BODY_WAVING: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0,0,1], // right arm raised
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,0,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,1,0,0,0,1,0,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
]
const BODY_EATING_A: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,0,0,0,1,1,1,1], // arms bent up holding bowl
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,1,0,0,0,1,0,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
]
const BODY_EATING_B: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [1,0,1,1,1,0,0,0,1,1,1], // right arm raised higher (lifting to mouth)
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,1,0,0,0,1,0,0,0],
  [1,0,1,0,0,0,0,0,1,0,1],
]

const BODY_THINKING: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,0,1,0,0,1,1,0], // diagonal mouth
  [0,1,0,1,0,0,0,1,0,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
]

function buildGrid(body: number[][], ant: number[][], eye: number[]): number[][] {
  const g = body.map(r => [...r])
  g[0] = [...ant[0]]
  g[1] = [...ant[1]]
  if (body !== BODY_SLEEPING) g[3] = [...eye]
  return g
}

// ── Component ─────────────────────────────────────────────────────────────
export default function PetCanvas({
  anim, appearance, size,
}: {
  anim:       PetAnim
  appearance: PetAppearance
  size:       number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx    = canvas.getContext('2d')!
    const pal    = PALETTES[appearance.colorIndex] ?? PALETTES[0]
    const ant    = ANTENNAS[appearance.earIndex]   ?? ANTENNAS[0]
    const eye    = EYE_ROWS[appearance.faceIndex]  ?? EYE_ROWS[0]

    // Each logical pixel fills ~82 % of the canvas
    const scale  = Math.max(1, Math.floor((size * 0.82) / PW))
    const aw     = PW * scale
    const ah     = PH * scale
    const ox     = Math.round((size - aw) / 2)
    const oy     = Math.round((size - ah) / 2)

    const TOGGLE = anim === 'TALKING' ? 220 : 650
    let frame = 0, lastT = 0

    function draw(ts: number) {
      if (ts - lastT > TOGGLE) { frame ^= 1; lastT = ts }

      let body: number[][]
      switch (anim) {
        case 'HAPPY':    body = BODY_HAPPY; break
        case 'SLEEPING': body = BODY_SLEEPING; break
        case 'WAVING':   body = frame % 2 ? BODY_A : BODY_WAVING; break
        case 'TALKING':  body = frame % 2 ? BODY_A : BODY_TALKING_OPEN; break
        case 'THINKING': body = BODY_THINKING; break
        case 'EATING':   body = frame % 2 ? BODY_EATING_B : BODY_EATING_A; break
        default:         body = frame % 2 ? BODY_B : BODY_A
      }

      const grid = buildGrid(body, ant, eye)
      ctx.clearRect(0, 0, size, size)

      // Glow on happy
      if (anim === 'HAPPY') {
        ctx.fillStyle = pal.glow
        ctx.beginPath()
        ctx.ellipse(size / 2, size / 2 + scale, aw / 2 + scale * 2, ah / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Pixel grid
      for (let r = 0; r < PH; r++) {
        for (let c = 0; c < PW; c++) {
          if (!grid[r][c]) continue
          const x = ox + c * scale
          const y = oy + r * scale
          // Shadow (1px offset)
          ctx.fillStyle = pal.shadow
          ctx.fillRect(x + 1, y + 1, scale, scale)
          // Main pixel
          ctx.fillStyle = pal.body
          ctx.fillRect(x, y, scale, scale)
        }
      }

      // Sleeping Zs
      if (anim === 'SLEEPING') {
        ctx.fillStyle = pal.body
        ctx.font = `bold ${Math.round(scale * 1.5)}px monospace`
        ctx.textAlign = 'left'
        ctx.fillText('z', ox + aw + 2, oy + scale)
        if (frame % 2 === 0)
          ctx.fillText('Z', ox + aw + scale, oy - scale * 0.5)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [anim, appearance, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  )
}

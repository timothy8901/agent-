import { useState, useEffect, useRef, useCallback } from 'react'
import type { PetAppearance } from '../PetCanvas'

const GAME_W = 360
const GAME_H = 240
const PLAYER_W = 34
const PLAYER_H = 20
const PLAYER_Y = GAME_H - 34
const PLAYER_SPEED = 3.5
const BULLET_SPEED = 7
const ALIEN_BULLET_SPEED = 2.2
const COLS = 9
const ROWS = 4
const ALIEN_W = 26
const ALIEN_H = 18
const PAD_X = 8
const PAD_Y = 10
const GRID_X0 = Math.floor((GAME_W - COLS * (ALIEN_W + PAD_X)) / 2)
const GRID_Y0 = 24

const ALIEN_COLORS = ['#0f0', '#0f0', '#0ff', '#ff0'] as const
const PALETTES = ['#FF7043', '#42A5F5', '#66BB6A', '#AB47BC', '#EC407A']

interface Alien  { col: number; row: number; alive: boolean; x: number; y: number }
interface Bullet { x: number; y: number; fromPlayer: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
type Phase = 'IDLE' | 'PLAYING' | 'GAMEOVER'

function makeAliens(): Alien[] {
  const out: Alien[] = []
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++)
      out.push({ col, row, alive: true,
        x: GRID_X0 + col * (ALIEN_W + PAD_X),
        y: GRID_Y0 + row * (ALIEN_H + PAD_Y) })
  return out
}

function drawAlien(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, frame: number, color: string) {
  ctx.fillStyle = color
  const cx = x + ALIEN_W / 2

  if (row === 0) {
    // UFO saucer — top row, worth 30 pts
    ctx.fillRect(cx - 8, y,     3, 5)      // antennae L
    ctx.fillRect(cx + 5, y,     3, 5)      // antennae R
    ctx.beginPath()
    ctx.ellipse(cx, y + 9, 11, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 7, y + 8, 3, 3)
    ctx.fillRect(cx - 1, y + 7, 4, 3)
    ctx.fillRect(cx + 4, y + 8, 3, 3)
    ctx.fillStyle = color
    ctx.fillRect(cx - 5, y + 14, 10, 3)
    ctx.fillRect(cx - 8, y + 16, 16, 2)
  } else if (row <= 2) {
    // Classic invader — middle rows, worth 20 pts
    ctx.fillRect(cx - 7, y + 1, 4, 4)     // head bumps
    ctx.fillRect(cx + 3, y + 1, 4, 4)
    ctx.fillRect(cx - 9, y + 4, 18, 9)    // body
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 6, y + 6, 4, 3)     // eyes
    ctx.fillRect(cx + 2, y + 6, 4, 3)
    ctx.fillStyle = color
    if (frame % 2 === 0) {
      ctx.fillRect(cx - 13, y + 8,  5, 3)
      ctx.fillRect(cx + 8,  y + 8,  5, 3)
      ctx.fillRect(cx - 9,  y + 13, 3, 4)
      ctx.fillRect(cx + 6,  y + 13, 3, 4)
    } else {
      ctx.fillRect(cx - 11, y + 10, 3, 5)
      ctx.fillRect(cx + 8,  y + 10, 3, 5)
      ctx.fillRect(cx - 7,  y + 13, 4, 4)
      ctx.fillRect(cx + 3,  y + 13, 4, 4)
    }
  } else {
    // Crab — bottom row, worth 10 pts
    ctx.fillRect(cx - 10, y + 3, 20, 10)
    if (frame % 2 === 0) {
      ctx.fillRect(cx - 13, y + 1, 4, 6)
      ctx.fillRect(cx + 9,  y + 1, 4, 6)
    } else {
      ctx.fillRect(cx - 12, y + 4, 4, 6)
      ctx.fillRect(cx + 8,  y + 4, 4, 6)
    }
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 6, y + 5, 3, 3)
    ctx.fillRect(cx + 3, y + 5, 3, 3)
    ctx.fillStyle = color
    ctx.fillRect(cx - 8, y + 13, 2, 4)
    ctx.fillRect(cx - 4, y + 13, 2, 5)
    ctx.fillRect(cx + 2, y + 13, 2, 5)
    ctx.fillRect(cx + 6, y + 13, 2, 4)
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x + 10, PLAYER_Y,      14, 12)  // top body
  ctx.fillRect(x + 4,  PLAYER_Y + 10, 26, 8)   // mid body
  ctx.fillRect(x,      PLAYER_Y + 14, 34, 6)   // base
  ctx.fillRect(x + 14, PLAYER_Y - 6,  6,  8)   // cannon
  ctx.fillStyle = 'rgba(255,180,0,0.8)'
  ctx.fillRect(x + 7,  PLAYER_Y + 18, 6, 3)    // engine glow L
  ctx.fillRect(x + 21, PLAYER_Y + 18, 6, 3)    // engine glow R
}

// Static star positions (deterministic)
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: ((i * 137 + 17) * 53) % GAME_W,
  y: ((i * 97  + 31) * 71) % GAME_H,
  s: i % 3 === 0 ? 2 : 1,
}))

interface Props { appearance: PetAppearance; petName: string }

export default function SpaceInvaders({ appearance, petName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase,     setPhase]     = useState<Phase>('IDLE')
  const [score,     setScore]     = useState(0)
  const [lives,     setLives]     = useState(3)
  const [wave,      setWave]      = useState(1)
  const [bestScore, setBestScore] = useState(() =>
    parseInt(localStorage.getItem('si-best') ?? '0'))

  const petColor = PALETTES[appearance.colorIndex] ?? '#FF7043'

  const g = useRef({
    phase: 'IDLE' as Phase,
    aliens: [] as Alien[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    playerX: GAME_W / 2 - PLAYER_W / 2,
    score: 0, lives: 3, wave: 1,
    alienDir: 1,
    alienMoveTimer: 0, alienMoveInterval: 60,
    alienShootTimer: 0, alienShootInterval: 90,
    alienFrame: 0,
    keys: { left: false, right: false, fire: false },
    lastFire: 0,
    invincibleUntil: 0,
  })
  const rafRef  = useRef(0)
  const lastTs  = useRef(0)

  function initWave(w: number) {
    const s = g.current
    s.aliens = makeAliens()
    s.bullets = []
    s.alienDir = 1
    s.alienMoveTimer = 0
    s.alienMoveInterval = Math.max(12, 60 - w * 7)
    s.alienShootTimer = 0
    s.alienShootInterval = Math.max(35, 90 - w * 10)
    s.alienFrame = 0
  }

  function endGame() {
    const s = g.current
    s.phase = 'GAMEOVER'
    setPhase('GAMEOVER')
    setBestScore(prev => {
      const nb = Math.max(prev, s.score)
      localStorage.setItem('si-best', String(nb))
      return nb
    })
    cancelAnimationFrame(rafRef.current)
  }

  const tick = useCallback((ts: number) => {
    if (!lastTs.current) lastTs.current = ts
    const dt = Math.min((ts - lastTs.current) / 16.67, 3)
    lastTs.current = ts

    const s = g.current
    const canvas = canvasRef.current
    if (!canvas || s.phase !== 'PLAYING') return
    const ctx = canvas.getContext('2d')!

    // ── Player movement ────────────────────────────────────────────────
    if (s.keys.left)  s.playerX = Math.max(0, s.playerX - PLAYER_SPEED * dt)
    if (s.keys.right) s.playerX = Math.min(GAME_W - PLAYER_W, s.playerX + PLAYER_SPEED * dt)

    // ── Player fire ────────────────────────────────────────────────────
    if (s.keys.fire && ts - s.lastFire > 280) {
      s.bullets.push({ x: s.playerX + PLAYER_W / 2, y: PLAYER_Y, fromPlayer: true })
      s.lastFire = ts
    }

    // ── Move bullets ───────────────────────────────────────────────────
    s.bullets = s.bullets.filter(b => b.y > -10 && b.y < GAME_H + 10)
    for (const b of s.bullets)
      b.y += (b.fromPlayer ? -BULLET_SPEED : ALIEN_BULLET_SPEED) * dt

    // ── Move aliens ────────────────────────────────────────────────────
    s.alienMoveTimer += dt
    if (s.alienMoveTimer >= s.alienMoveInterval) {
      s.alienMoveTimer = 0
      s.alienFrame ^= 1
      let minX = Infinity, maxX = -Infinity
      for (const a of s.aliens) if (a.alive) { minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x + ALIEN_W) }
      const step = 10
      const wouldHit = maxX + step * s.alienDir >= GAME_W || minX + step * s.alienDir <= 0
      for (const a of s.aliens) if (a.alive) {
        if (wouldHit) { a.y += 12 } else { a.x += step * s.alienDir }
      }
      if (wouldHit) s.alienDir *= -1
    }

    // ── Alien shooting ─────────────────────────────────────────────────
    s.alienShootTimer += dt
    if (s.alienShootTimer >= s.alienShootInterval) {
      s.alienShootTimer = 0
      const bottoms: Alien[] = []
      for (let col = 0; col < COLS; col++) {
        const col_ = s.aliens.filter(a => a.alive && a.col === col).sort((a, b) => b.row - a.row)
        if (col_.length) bottoms.push(col_[0])
      }
      if (bottoms.length) {
        const shooter = bottoms[Math.floor(Math.random() * bottoms.length)]
        s.bullets.push({ x: shooter.x + ALIEN_W / 2, y: shooter.y + ALIEN_H, fromPlayer: false })
      }
    }

    // ── Bullet × alien ────────────────────────────────────────────────
    for (const b of s.bullets) {
      if (!b.fromPlayer) continue
      for (const a of s.aliens) {
        if (!a.alive || b.y < a.y || b.y > a.y + ALIEN_H || b.x < a.x || b.x > a.x + ALIEN_W) continue
        a.alive = false
        b.y = -9999
        const pts = a.row === 0 ? 30 : a.row <= 2 ? 20 : 10
        s.score += pts
        setScore(s.score)
        const color = ALIEN_COLORS[a.row]
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          s.particles.push({ x: a.x + ALIEN_W / 2, y: a.y + ALIEN_H / 2,
            vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2, life: 28, color })
        }
      }
    }

    // ── Bullet × player ───────────────────────────────────────────────
    if (ts > s.invincibleUntil) {
      for (const b of s.bullets) {
        if (b.fromPlayer) continue
        if (b.x < s.playerX || b.x > s.playerX + PLAYER_W || b.y < PLAYER_Y || b.y > PLAYER_Y + PLAYER_H) continue
        b.y = 9999
        s.lives--
        setLives(s.lives)
        s.invincibleUntil = ts + 1800
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2
          s.particles.push({ x: s.playerX + PLAYER_W / 2, y: PLAYER_Y + PLAYER_H / 2,
            vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, life: 36, color: petColor })
        }
        if (s.lives <= 0) { endGame(); return }
      }
    }

    // ── Aliens reach bottom ────────────────────────────────────────────
    for (const a of s.aliens)
      if (a.alive && a.y + ALIEN_H >= PLAYER_Y - 4) { endGame(); return }

    // ── Wave clear ────────────────────────────────────────────────────
    if (s.aliens.every(a => !a.alive)) {
      s.wave++
      setWave(s.wave)
      s.score += 100 * (s.wave - 1)
      setScore(s.score)
      initWave(s.wave)
    }

    // ── Particles ─────────────────────────────────────────────────────
    s.particles = s.particles.filter(p => p.life > 0)
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life--; p.vx *= 0.94; p.vy *= 0.94 }

    // ── Draw ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#000814'
    ctx.fillRect(0, 0, GAME_W, GAME_H)

    // Stars
    for (const star of STARS) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + (star.s - 1) * 0.4})`
      ctx.fillRect(star.x, star.y, star.s, star.s)
    }

    // Ground
    ctx.fillStyle = '#0f0'
    ctx.fillRect(0, GAME_H - 9, GAME_W, 1)
    ctx.fillStyle = '#1a3a1a'
    ctx.fillRect(0, GAME_H - 8, GAME_W, 8)

    // Aliens
    for (const a of s.aliens) if (a.alive)
      drawAlien(ctx, a.x, a.y, a.row, s.alienFrame, ALIEN_COLORS[Math.min(a.row, 3)])

    // Player (blink when invincible)
    const blink = ts < s.invincibleUntil && Math.floor(ts / 120) % 2 === 0
    if (!blink) drawPlayer(ctx, s.playerX, petColor)

    // Bullets
    for (const b of s.bullets) {
      if (b.fromPlayer) {
        ctx.fillStyle = '#ffe066'
        ctx.fillRect(b.x - 2, b.y - 10, 4, 10)
        ctx.fillStyle = 'rgba(255,220,0,0.25)'
        ctx.fillRect(b.x - 4, b.y - 10, 8, 10)
      } else {
        ctx.fillStyle = '#ff4444'
        ctx.fillRect(b.x - 2, b.y, 4, 12)
        ctx.fillStyle = 'rgba(255,50,50,0.25)'
        ctx.fillRect(b.x - 4, b.y, 8, 12)
      }
    }

    // Particles
    for (const p of s.particles) {
      const a = p.life / 28
      ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2, '0')
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }

    // CRT scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.07)'
    for (let sy = 0; sy < GAME_H; sy += 3) ctx.fillRect(0, sy, GAME_W, 1)

    rafRef.current = requestAnimationFrame(tick)
  }, [petColor])

  function startGame() {
    const s = g.current
    s.phase = 'PLAYING'
    s.score = 0; s.lives = 3; s.wave = 1
    s.playerX = GAME_W / 2 - PLAYER_W / 2
    s.lastFire = 0; s.invincibleUntil = 0
    initWave(1)
    setPhase('PLAYING'); setScore(0); setLives(3); setWave(1)
    lastTs.current = 0
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const k = g.current.keys
      if (e.key === 'ArrowLeft'  || e.key === 'a') k.left  = down
      if (e.key === 'ArrowRight' || e.key === 'd') k.right = down
      if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); k.fire = down }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup',   ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const aliveCount = g.current.aliens.filter(a => a.alive).length

  return (
    <div className="game-si">
      {/* HUD */}
      <div className="si-hud">
        <div className="si-hud-cell">
          <span className="si-hud-val">{score}</span>
          <span className="si-hud-lbl">SCORE</span>
        </div>
        <div className="si-hud-cell">
          <span className="si-hud-val si-wave-num">W{wave}</span>
          <span className="si-hud-lbl">{phase === 'PLAYING' ? `${aliveCount} LEFT` : 'WAVE'}</span>
        </div>
        <div className="si-hud-cell">
          <span className="si-hud-val">{bestScore}</span>
          <span className="si-hud-lbl">BEST</span>
        </div>
      </div>

      {/* Lives */}
      <div className="si-lives">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={`si-ship-icon ${i < lives ? 'alive' : 'dead'}`}>▲</span>
        ))}
      </div>

      {/* Canvas */}
      <div className="si-canvas-wrap">
        <canvas ref={canvasRef} width={GAME_W} height={GAME_H} className="si-canvas" />

        {phase === 'IDLE' && (
          <div className="si-overlay">
            <div className="si-big-title">👾 INVADERS</div>
            <p className="si-sub">Defend {petName} from the horde!</p>
            <div className="si-key-hint">← → move · Space fire</div>
            <button className="game-start-btn" onClick={startGame}>INSERT COIN</button>
          </div>
        )}

        {phase === 'GAMEOVER' && (
          <div className="si-overlay">
            <div className="si-big-title" style={{ color: '#ef5350' }}>GAME OVER</div>
            <p className="si-sub">{score > 0 && score >= bestScore ? '🏆 NEW BEST!' : 'The aliens won…'}</p>
            <p className="si-final">{score} pts</p>
            <button className="game-start-btn" onClick={startGame}>RETRY</button>
          </div>
        )}
      </div>

      {/* On-screen D-pad */}
      {phase === 'PLAYING' && (
        <div className="si-btn-row">
          <button className="si-ctrl-btn"
            onPointerDown={() => (g.current.keys.left  = true)}
            onPointerUp={()   => (g.current.keys.left  = false)}
            onPointerLeave={() => (g.current.keys.left  = false)}>◀</button>
          <button className="si-ctrl-btn si-fire-btn"
            onPointerDown={() => (g.current.keys.fire  = true)}
            onPointerUp={()   => (g.current.keys.fire  = false)}
            onPointerLeave={() => (g.current.keys.fire  = false)}>🔥 FIRE</button>
          <button className="si-ctrl-btn"
            onPointerDown={() => (g.current.keys.right = true)}
            onPointerUp={()   => (g.current.keys.right = false)}
            onPointerLeave={() => (g.current.keys.right = false)}>▶</button>
        </div>
      )}
    </div>
  )
}

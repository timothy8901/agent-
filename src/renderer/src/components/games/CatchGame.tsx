import { useState, useEffect, useRef, useCallback } from 'react'
import PetCanvas from '../PetCanvas'
import type { PetAppearance } from '../PetCanvas'

const GAME_W = 360
const GAME_H = 220
const GAME_DURATION = 30

type Phase = 'IDLE' | 'PLAYING' | 'END'

interface Ball {
  x:  number
  y:  number
  vx: number
  vy: number
  r:  number
  hue: number
}

function makeBall(score: number): Ball {
  const r    = Math.max(14, 26 - score * 0.6)
  const speed = 2.5 + score * 0.18
  const angle = Math.random() * Math.PI * 2
  return {
    x:   GAME_W / 2,
    y:   GAME_H / 2,
    vx:  Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed,
    r,
    hue: Math.floor(Math.random() * 360),
  }
}

interface Props {
  appearance: PetAppearance
  petName:    string
}

export default function CatchGame({ appearance, petName }: Props) {
  const [phase,     setPhase]     = useState<Phase>('IDLE')
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(() => parseInt(localStorage.getItem('catch-best') ?? '0'))
  const [timeLeft,  setTimeLeft]  = useState(GAME_DURATION)
  const [ball,      setBall]      = useState<Ball>(() => makeBall(0))
  const [petAnim,   setPetAnim]   = useState<'IDLE' | 'HAPPY' | 'SLEEPING'>('IDLE')
  const [combo,     setCombo]     = useState(0)
  const [floatTexts, setFloatTexts] = useState<{ id: number; x: number; y: number; text: string }[]>([])

  const rafRef   = useRef<number>(0)
  const lastTime = useRef<number>(0)
  const scoreRef = useRef(0)
  const nextId   = useRef(0)

  // Physics loop
  const tick = useCallback((ts: number) => {
    if (!lastTime.current) lastTime.current = ts
    const dt = Math.min((ts - lastTime.current) / 16.67, 3)
    lastTime.current = ts

    setBall(prev => {
      let { x, y, vx, vy, r, hue } = prev
      x += vx * dt
      y += vy * dt
      if (x - r < 0)       { x = r;          vx = Math.abs(vx)  }
      if (x + r > GAME_W)  { x = GAME_W - r; vx = -Math.abs(vx) }
      if (y - r < 0)       { y = r;          vy = Math.abs(vy)   }
      if (y + r > GAME_H)  { y = GAME_H - r; vy = -Math.abs(vy)  }
      return { x, y, vx, vy, r, hue }
    })

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // Timer
  useEffect(() => {
    if (phase !== 'PLAYING') return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t)
          setPhase('END')
          setBestScore(best => {
            const newBest = Math.max(best, scoreRef.current)
            localStorage.setItem('catch-best', String(newBest))
            return newBest
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  function startGame() {
    scoreRef.current = 0
    setScore(0)
    setCombo(0)
    setTimeLeft(GAME_DURATION)
    setBall(makeBall(0))
    setPhase('PLAYING')
    lastTime.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }

  function hitBall(e: React.MouseEvent<HTMLDivElement>) {
    if (phase !== 'PLAYING') return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top

    setBall(prev => {
      const dx = mx - prev.x
      const dy = my - prev.y
      if (Math.sqrt(dx * dx + dy * dy) > prev.r + 8) return prev  // miss

      const newCombo = combo + 1
      const pts      = newCombo >= 3 ? 3 : newCombo >= 2 ? 2 : 1
      const newScore = scoreRef.current + pts
      scoreRef.current = newScore

      setCombo(newCombo)
      setScore(newScore)

      // float text
      const id = nextId.current++
      setFloatTexts(ft => [...ft, { id, x: prev.x, y: prev.y, text: newCombo >= 3 ? `+${pts} COMBO!` : `+${pts}` }])
      setTimeout(() => setFloatTexts(ft => ft.filter(f => f.id !== id)), 800)

      // pet reacts
      setPetAnim('HAPPY')
      setTimeout(() => setPetAnim('IDLE'), 600)

      return makeBall(newScore)
    })
  }

  useEffect(() => {
    if (phase !== 'PLAYING') { cancelAnimationFrame(rafRef.current); lastTime.current = 0 }
  }, [phase])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const timerPct = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 10 ? '#4CAF50' : timeLeft > 5 ? '#FF9800' : '#ef5350'

  return (
    <div className="game-catch">
      {/* Header */}
      <div className="catch-header">
        <div className="catch-score-box">
          <span className="catch-score">{phase === 'PLAYING' ? score : (phase === 'END' ? score : '–')}</span>
          <span className="catch-score-label">pts</span>
        </div>
        <div className="catch-timer-wrap">
          <div className="catch-timer-bar" style={{ width: `${timerPct}%`, background: timerColor }} />
          <span className="catch-timer-num">{timeLeft}s</span>
        </div>
        <div className="catch-best-box">
          <span className="catch-best">{bestScore}</span>
          <span className="catch-score-label">best</span>
        </div>
      </div>

      {/* Game area */}
      <div
        className="catch-arena"
        style={{ width: GAME_W, height: GAME_H }}
        onClick={hitBall}
      >
        {phase === 'IDLE' && (
          <div className="catch-start-overlay">
            <PetCanvas anim="WAVING" appearance={appearance} size={80} />
            <p>Click the ball as fast as you can!</p>
            <button className="game-start-btn" onClick={e => { e.stopPropagation(); startGame() }}>
              Start!
            </button>
          </div>
        )}

        {phase === 'END' && (
          <div className="catch-start-overlay">
            <PetCanvas anim={score > bestScore - 1 ? 'HAPPY' : 'SLEEPING'} appearance={appearance} size={80} />
            <p className="catch-end-score">
              {score >= bestScore && score > 0 ? '🏆 New Best!' : 'Nice try!'} {score} pts
            </p>
            <button className="game-start-btn" onClick={e => { e.stopPropagation(); startGame() }}>
              Again!
            </button>
          </div>
        )}

        {phase === 'PLAYING' && (
          <>
            {/* Ball */}
            <div
              className="catch-ball"
              style={{
                left:   ball.x - ball.r,
                top:    ball.y - ball.r,
                width:  ball.r * 2,
                height: ball.r * 2,
                background: `hsl(${ball.hue}, 85%, 60%)`,
                boxShadow: `0 0 ${ball.r}px hsl(${ball.hue}, 85%, 60%)`,
              }}
            />
            {/* Floating point texts */}
            {floatTexts.map(ft => (
              <div key={ft.id} className="float-text" style={{ left: ft.x, top: ft.y - 20 }}>
                {ft.text}
              </div>
            ))}
            {/* Combo indicator */}
            {combo >= 2 && (
              <div className="combo-indicator">🔥 x{combo}</div>
            )}
          </>
        )}
      </div>

      {/* Pet row below arena */}
      {phase === 'PLAYING' && (
        <div className="catch-pet-row">
          <PetCanvas anim={petAnim} appearance={appearance} size={50} />
          <span className="catch-pet-msg">
            {combo >= 3 ? `Woah ${petName}! You're on FIRE! 🔥` : combo >= 2 ? 'Nice combo! 🎯' : 'Catch it! Go go!'}
          </span>
        </div>
      )}
    </div>
  )
}

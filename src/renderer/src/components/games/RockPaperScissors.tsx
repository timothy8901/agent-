import { useState, useEffect } from 'react'
import PetCanvas from '../PetCanvas'
import type { PetAppearance } from '../PetCanvas'

type Choice  = 'rock' | 'paper' | 'scissors'
type Outcome = 'win' | 'lose' | 'tie'

const CHOICES: Choice[] = ['rock', 'paper', 'scissors']
const EMOJI: Record<Choice, string> = { rock: '🪨', paper: '📄', scissors: '✂️' }

const BEATS: Record<Choice, Choice> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

function getOutcome(player: Choice, pet: Choice): Outcome {
  if (player === pet) return 'tie'
  return BEATS[player] === pet ? 'win' : 'lose'
}

const PET_QUIPS: Record<Outcome, string[]> = {
  win:  ['Nooo! 😭 You beat me!', 'How?! Rematch!', 'I let you win… *sobs*'],
  lose: ['Ha! I WIN! 🎉', 'Too easy! Play again?', 'Bow before me! 😏'],
  tie:  ["We think alike! 🤝", "Great minds…", "Twins! Go again?"],
}

interface Score { wins: number; losses: number; ties: number }

interface Props {
  appearance: PetAppearance
  petName:    string
}

type Phase = 'CHOOSE' | 'REVEAL' | 'RESULT'

export default function RockPaperScissors({ appearance, petName }: Props) {
  const [phase,      setPhase]      = useState<Phase>('CHOOSE')
  const [playerPick, setPlayerPick] = useState<Choice | null>(null)
  const [petPick,    setPetPick]    = useState<Choice | null>(null)
  const [outcome,    setOutcome]    = useState<Outcome | null>(null)
  const [quip,       setQuip]       = useState('')
  const [score,      setScore]      = useState<Score>({ wins: 0, losses: 0, ties: 0 })
  const [countdown,  setCountdown]  = useState(3)
  const [shaking,    setShaking]    = useState(false)

  function choose(c: Choice) {
    setPlayerPick(c)
    setPhase('REVEAL')
    setCountdown(3)
    setShaking(true)
  }

  // Countdown then reveal
  useEffect(() => {
    if (phase !== 'REVEAL') return
    if (countdown <= 0) {
      const pet = CHOICES[Math.floor(Math.random() * 3)]
      setPetPick(pet)
      const out = getOutcome(playerPick!, pet)
      setOutcome(out)
      setQuip(PET_QUIPS[out][Math.floor(Math.random() * PET_QUIPS[out].length)])
      setScore(prev => ({
        wins:   prev.wins   + (out === 'win'  ? 1 : 0),
        losses: prev.losses + (out === 'lose' ? 1 : 0),
        ties:   prev.ties   + (out === 'tie'  ? 1 : 0),
      }))
      setShaking(false)
      setPhase('RESULT')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 500)
    return () => clearTimeout(t)
  }, [phase, countdown, playerPick])

  function reset() {
    setPhase('CHOOSE')
    setPlayerPick(null)
    setPetPick(null)
    setOutcome(null)
    setQuip('')
  }

  const petAnim = phase === 'REVEAL'  ? 'THINKING'
                : outcome === 'win'   ? 'SLEEPING'   // pet sulking
                : outcome === 'lose'  ? 'HAPPY'
                : outcome === 'tie'   ? 'WAVING'
                : 'IDLE'

  return (
    <div className="game-rps">
      {/* Score bar */}
      <div className="rps-score">
        <span className="score-item win">🏆 {score.wins}</span>
        <span className="score-item tie">🤝 {score.ties}</span>
        <span className="score-item lose">💀 {score.losses}</span>
      </div>

      {/* Pet + speech */}
      <div className="rps-pet-row">
        <div className={`rps-pet-wrap ${shaking ? 'shake' : ''}`}>
          <PetCanvas anim={petAnim} appearance={appearance} size={90} />
        </div>

        {phase === 'REVEAL' && (
          <div className="rps-countdown">{countdown > 0 ? countdown : '...'}</div>
        )}
        {phase === 'RESULT' && (
          <div className="speech-bubble-small">{quip}</div>
        )}
      </div>

      {/* Choices / result */}
      {phase === 'CHOOSE' && (
        <>
          <p className="rps-prompt">Pick your move!</p>
          <div className="rps-choices">
            {CHOICES.map(c => (
              <button key={c} className="rps-btn" onClick={() => choose(c)}>
                <span className="rps-emoji">{EMOJI[c]}</span>
                <span className="rps-label">{c}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'REVEAL' && (
        <div className="rps-shaking">
          <span className="rps-emoji-lg">{EMOJI[playerPick!]}</span>
          <span className="rps-vs">vs</span>
          <span className="rps-emoji-lg">🤔</span>
        </div>
      )}

      {phase === 'RESULT' && (
        <>
          <div className="rps-result-row">
            <div className="rps-pick-box">
              <span className="rps-emoji-lg">{EMOJI[playerPick!]}</span>
              <span className="rps-pick-label">You</span>
            </div>
            <div className={`rps-outcome-badge outcome-${outcome}`}>
              {outcome === 'win' ? 'WIN!' : outcome === 'lose' ? 'LOSE' : 'TIE'}
            </div>
            <div className="rps-pick-box">
              <span className="rps-emoji-lg">{EMOJI[petPick!]}</span>
              <span className="rps-pick-label">{petName}</span>
            </div>
          </div>
          <button className="game-play-again" onClick={reset}>Play Again</button>
        </>
      )}
    </div>
  )
}

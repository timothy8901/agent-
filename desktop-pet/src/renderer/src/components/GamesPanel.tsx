import { useState } from 'react'
import type { PetAppearance } from './PetCanvas'
import RockPaperScissors from './games/RockPaperScissors'
import CatchGame from './games/CatchGame'

type GameId = null | 'rps' | 'catch'

interface Props {
  appearance: PetAppearance
  petName:    string
  onClose:    () => void
}

export default function GamesPanel({ appearance, petName, onClose }: Props) {
  const [activeGame, setActiveGame] = useState<GameId>(null)

  return (
    <div className="games-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeGame && (
            <button className="icon-btn" onClick={() => setActiveGame(null)}>←</button>
          )}
          <span className="panel-title">
            {activeGame === 'rps'   ? '🪨 Rock Paper Scissors'
           : activeGame === 'catch' ? '🎯 Catch!'
           : '🎮 Games'}
          </span>
        </div>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="games-body">
        {!activeGame && (
          <div className="game-select">
            <button className="game-card" onClick={() => setActiveGame('rps')}>
              <span className="game-card-icon">🪨📄✂️</span>
              <span className="game-card-title">Rock Paper Scissors</span>
              <span className="game-card-desc">Challenge {petName} to best of all!</span>
            </button>
            <button className="game-card" onClick={() => setActiveGame('catch')}>
              <span className="game-card-icon">🎯</span>
              <span className="game-card-title">Catch!</span>
              <span className="game-card-desc">Click the bouncing ball. 30 seconds!</span>
            </button>
          </div>
        )}

        {activeGame === 'rps'   && <RockPaperScissors appearance={appearance} petName={petName} />}
        {activeGame === 'catch' && <CatchGame         appearance={appearance} petName={petName} />}
      </div>
    </div>
  )
}

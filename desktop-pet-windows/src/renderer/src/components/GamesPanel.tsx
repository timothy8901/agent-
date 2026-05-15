import { useState } from 'react'
import type { PetAppearance } from './PetCanvas'
import RockPaperScissors from './games/RockPaperScissors'
import CatchGame from './games/CatchGame'
import SpaceInvaders from './games/SpaceInvaders'

type GameId = null | 'rps' | 'catch' | 'si'

interface Props {
  appearance: PetAppearance
  petName:    string
  onClose:    () => void
}

export default function GamesPanel({ appearance, petName, onClose }: Props) {
  const [activeGame, setActiveGame] = useState<GameId>(null)

  const titles: Record<NonNullable<GameId>, string> = {
    rps:   '🪨 Rock Paper Scissors',
    catch: '🎯 Catch!',
    si:    '👾 Space Invaders',
  }

  return (
    <div className="games-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeGame && (
            <button className="icon-btn" onClick={() => setActiveGame(null)}>←</button>
          )}
          <span className="panel-title">
            {activeGame ? titles[activeGame] : '🎮 Games'}
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
            <button className="game-card" onClick={() => setActiveGame('si')}>
              <span className="game-card-icon">👾</span>
              <span className="game-card-title">Space Invaders</span>
              <span className="game-card-desc">Defend {petName} from the alien horde!</span>
            </button>
          </div>
        )}

        {activeGame === 'rps'   && <RockPaperScissors appearance={appearance} petName={petName} />}
        {activeGame === 'catch' && <CatchGame         appearance={appearance} petName={petName} />}
        {activeGame === 'si'    && <SpaceInvaders     appearance={appearance} petName={petName} />}
      </div>
    </div>
  )
}

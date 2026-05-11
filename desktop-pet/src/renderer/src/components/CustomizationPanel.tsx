import PetCanvas, { PetAppearance } from './PetCanvas'
import { COLOR_NAMES, COLOR_SWATCHES, FACE_NAMES, EAR_NAMES } from '../hooks/usePetAppearance'

interface Props {
  appearance: PetAppearance
  petName:    string
  onSetColor: (i: number) => void
  onSetFace:  (i: number) => void
  onSetEar:   (i: number) => void
  onClose:    () => void
}

const FACE_PREVIEWS = ['👁', '😊', '😎', '✨', '•']
const EAR_PREVIEWS  = ['💧', '🐱', '🐰', '⭕', '😈']

export default function CustomizationPanel({
  appearance, petName,
  onSetColor, onSetFace, onSetEar, onClose
}: Props) {
  return (
    <div className="custom-panel">
      <div className="chat-header">
        <span className="panel-title">Customize {petName}</span>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="custom-body">
        {/* Live preview */}
        <div className="custom-preview">
          <PetCanvas anim="HAPPY" appearance={appearance} size={110} />
        </div>

        {/* Color */}
        <section className="custom-section">
          <div className="custom-section-label">Color</div>
          <div className="custom-row">
            {COLOR_SWATCHES.map((hex, i) => (
              <button
                key={i}
                className={`swatch ${appearance.colorIndex === i ? 'active' : ''}`}
                style={{ background: hex }}
                onClick={() => onSetColor(i)}
                title={COLOR_NAMES[i]}
              >
                {appearance.colorIndex === i && <span className="swatch-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="custom-selected-label">{COLOR_NAMES[appearance.colorIndex]}</div>
        </section>

        {/* Face */}
        <section className="custom-section">
          <div className="custom-section-label">Eyes</div>
          <div className="custom-row">
            {FACE_NAMES.map((name, i) => (
              <button
                key={i}
                className={`option-chip ${appearance.faceIndex === i ? 'active' : ''}`}
                onClick={() => onSetFace(i)}
                title={name}
              >
                <span className="option-chip-icon">{FACE_PREVIEWS[i]}</span>
                <span className="option-chip-label">{name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Ears */}
        <section className="custom-section">
          <div className="custom-section-label">Ears</div>
          <div className="custom-row">
            {EAR_NAMES.map((name, i) => (
              <button
                key={i}
                className={`option-chip ${appearance.earIndex === i ? 'active' : ''}`}
                onClick={() => onSetEar(i)}
                title={name}
              >
                <span className="option-chip-icon">{EAR_PREVIEWS[i]}</span>
                <span className="option-chip-label">{name}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

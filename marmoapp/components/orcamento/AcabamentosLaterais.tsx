'use client'

import { getLateraisDaPeca } from './SeletorPeca'

export const ACABAMENTO_LABELS: Record<string, string> = {
  reto: 'Reto',
  boleado: 'Boleado',
  meia_esquadria: 'Meia Esquadria',
}

const LATERAL_LABELS: Record<string, string> = {
  esquerda: 'Lateral Esquerda',
  direita: 'Lateral Direita',
  frente: 'Frente',
  fundo: 'Fundo',
  superior: 'Superior',
  inferior: 'Inferior',
}

// Edge cross-section miniatura SVGs (50x50 viewBox, corner profile)
function SvgReto() {
  return (
    <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <rect x="8" y="8" width="34" height="34" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="1.8"/>
      <text x="25" y="29" textAnchor="middle" fontSize="7" fill="#888">90°</text>
    </svg>
  )
}

function SvgBoleado() {
  return (
    <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <path d="M8 42 L8 20 Q8 8 20 8 L42 8 L42 42 Z" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="1.8"/>
      <path d="M8 20 Q8 8 20 8" fill="none" stroke="#3498db" strokeWidth="1.5"/>
    </svg>
  )
}

function SvgMeiaEsquadria() {
  return (
    <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <path d="M8 42 L8 20 L20 8 L42 8 L42 42 Z" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="1.8"/>
      <line x1="8" y1="20" x2="20" y2="8" stroke="#e67e22" strokeWidth="1.5"/>
    </svg>
  )
}

const ACABAMENTO_SVG: Record<string, React.ReactNode> = {
  reto: <SvgReto />,
  boleado: <SvgBoleado />,
  meia_esquadria: <SvgMeiaEsquadria />,
}

interface Props {
  tipoPeca: string
  esquerda: string
  direita: string
  frente: string
  fundo: string
  dadosExtras: Record<string, unknown>
  showErrors: boolean
  onLateralChange: (lateral: string, acabamento: string) => void
  onRaioChange: (lateral: string, raio: number) => void
}

export default function AcabamentosLaterais({
  tipoPeca, esquerda, direita, frente, fundo, dadosExtras, showErrors,
  onLateralChange, onRaioChange,
}: Props) {
  const laterais = getLateraisDaPeca(tipoPeca)

  if (laterais.length === 0) return null

  const values: Record<string, string> = { esquerda, direita, frente, fundo }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
        Acabamento por lateral
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {laterais.map(lateral => {
          const current = values[lateral] || ''
          const hasError = showErrors && !current
          const raioKey = `raio_${lateral}`
          const raio = (dadosExtras[raioKey] as number) || 20

          return (
            <div key={lateral} style={{
              padding: '10px 12px',
              border: `1.5px solid ${hasError ? '#c0392b' : '#EDE9E2'}`,
              borderRadius: 8,
              background: hasError ? '#fff5f5' : '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', minWidth: 110 }}>
                  {LATERAL_LABELS[lateral] || lateral}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.keys(ACABAMENTO_LABELS).map(tipo => {
                    const sel = current === tipo
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => {
                          onLateralChange(lateral, tipo)
                          if (tipo === 'boleado' && !dadosExtras[raioKey]) {
                            onRaioChange(lateral, 20)
                          }
                        }}
                        title={ACABAMENTO_LABELS[tipo]}
                        style={{
                          border: `2px solid ${sel ? 'var(--gold)' : '#EDE9E2'}`,
                          borderRadius: 6,
                          background: sel ? '#fef8ec' : '#fff',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        {ACABAMENTO_SVG[tipo]}
                        <span style={{ fontSize: 9, color: sel ? 'var(--dark)' : '#888', fontWeight: sel ? 700 : 400 }}>
                          {ACABAMENTO_LABELS[tipo]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {current === 'boleado' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--gray)' }}>Raio (mm):</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    value={raio}
                    onChange={e => onRaioChange(lateral, parseInt(e.target.value) || 20)}
                    style={{ width: 70 }}
                  />
                </div>
              )}

              {hasError && (
                <p style={{ color: '#c0392b', fontSize: 11, marginTop: 4 }}>
                  Selecione o acabamento para esta lateral.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

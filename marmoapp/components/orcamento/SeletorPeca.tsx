'use client'

export type TipoPeca =
  | 'bancada_simples' | 'bancada_cuba' | 'bancada_saia' | 'bancada_frontao'
  | 'ilha_cozinha' | 'escada' | 'soleira' | 'nicho'
  | 'pia_l' | 'pia_u' | 'lavatorio_extensao'

export const PECA_LABELS: Record<string, string> = {
  bancada_simples: 'Bancada Simples',
  bancada_cuba: 'Bancada c/ Cuba',
  bancada_saia: 'Bancada c/ Saia',
  bancada_frontao: 'Bancada c/ Frontão',
  ilha_cozinha: 'Ilha de Cozinha',
  escada: 'Escada',
  soleira: 'Soleira / Peitoril',
  nicho: 'Nicho',
  pia_l: 'Pia em L',
  pia_u: 'Pia em U',
  lavatorio_extensao: 'Lavatório c/ Extensão',
}

export function getLateraisDaPeca(tipo: string, dadosExtras?: Record<string, unknown>): string[] {
  switch (tipo) {
    case 'bancada_simples': case 'bancada_cuba': case 'bancada_saia': case 'bancada_frontao':
      return ['esquerda', 'direita', 'frente']
    case 'ilha_cozinha':
      return ['esquerda', 'direita', 'frente', 'fundo']
    case 'nicho':
      return ['esquerda', 'direita', 'superior', 'inferior']
    case 'pia_l': case 'pia_u':
      return ['esquerda', 'direita', 'frente', 'fundo']
    case 'lavatorio_extensao': {
      const lado = (dadosExtras?.extensao_lado as string) || 'direita'
      return ['esquerda', 'direita', 'frente', 'fundo'].filter(l => l !== lado)
    }
    default:
      return []
  }
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11,
      background: on ? 'var(--gold)' : '#ddd',
      position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 20 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </div>
  )
}

function Err({ msg }: { msg: string }) {
  return <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>{msg}</p>
}

// ── SVGs ──────────────────────────────────────────────────────────────────────

function SvgBancadaSimples() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="24" width="136" height="44" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <line x1="12" y1="14" x2="148" y2="14" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="12" y1="10" x2="12" y2="18" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="148" y1="10" x2="148" y2="18" stroke="#bbb" strokeWidth="0.8"/>
      <text x="80" y="12" textAnchor="middle" fontSize="7" fill="#999">Largura</text>
      <line x1="154" y1="24" x2="154" y2="68" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="150" y1="24" x2="158" y2="24" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="150" y1="68" x2="158" y2="68" stroke="#bbb" strokeWidth="0.8"/>
      <text x="80" y="82" textAnchor="middle" fontSize="7" fill="#999">Tampo — vista de frente</text>
    </svg>
  )
}

function SvgBancadaCuba() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="18" width="136" height="54" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <rect x="42" y="28" width="76" height="34" fill="none" stroke="#3498db" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="80" y="48" textAnchor="middle" fontSize="8" fill="#3498db">cuba</text>
    </svg>
  )
}

function SvgBancadaSaia() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="136" height="34" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <rect x="12" y="44" width="136" height="36" fill="#e8f4fd" stroke="#3498db" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="80" y="66" textAnchor="middle" fontSize="8" fill="#3498db">saia</text>
      <line x1="4" y1="44" x2="4" y2="80" stroke="#3498db" strokeWidth="0.9"/>
      <line x1="0" y1="44" x2="8" y2="44" stroke="#3498db" strokeWidth="0.9"/>
      <line x1="0" y1="80" x2="8" y2="80" stroke="#3498db" strokeWidth="0.9"/>
    </svg>
  )
}

function SvgBancadaFrontao() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="34" y="22" width="92" height="46" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <rect x="8" y="22" width="26" height="46" fill="#fef0e6" stroke="#e67e22" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="21" y="48" textAnchor="middle" fontSize="8" fill="#e67e22">F</text>
      <rect x="126" y="22" width="26" height="46" fill="#fef0e6" stroke="#e67e22" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="139" y="48" textAnchor="middle" fontSize="8" fill="#e67e22">F</text>
    </svg>
  )
}

function SvgIlhaCozinha() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="16" width="116" height="58" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <text x="80" y="12" textAnchor="middle" fontSize="7" fill="#888">Frente</text>
      <text x="80" y="83" textAnchor="middle" fontSize="7" fill="#888">Fundo</text>
      <text x="10" y="48" textAnchor="middle" fontSize="7" fill="#888" transform="rotate(-90,10,48)">Esq</text>
      <text x="152" y="48" textAnchor="middle" fontSize="7" fill="#888" transform="rotate(90,152,48)">Dir</text>
    </svg>
  )
}

function SvgEscada() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <polyline
        points="10,80 10,60 57,60 57,40 104,40 104,20 150,20 150,80 10,80"
        fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="miter"
      />
      <text x="30" y="73" textAnchor="middle" fontSize="6.5" fill="#888">piso</text>
      <text x="78" y="53" textAnchor="middle" fontSize="6.5" fill="#888">piso</text>
      <text x="125" y="33" textAnchor="middle" fontSize="6.5" fill="#888">piso</text>
      <text x="60" y="52" fontSize="6" fill="#888" transform="rotate(-90,60,52)">esp</text>
      <text x="107" y="32" fontSize="6" fill="#888" transform="rotate(-90,107,32)">esp</text>
    </svg>
  )
}

function SvgSoleira() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="34" width="144" height="22" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <line x1="8" y1="24" x2="152" y2="24" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="8" y1="20" x2="8" y2="28" stroke="#bbb" strokeWidth="0.8"/>
      <line x1="152" y1="20" x2="152" y2="28" stroke="#bbb" strokeWidth="0.8"/>
      <text x="80" y="22" textAnchor="middle" fontSize="7" fill="#999">Comprimento</text>
      <text x="80" y="72" textAnchor="middle" fontSize="7" fill="#999">Peça linear</text>
    </svg>
  )
}

function SvgNicho() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="144" height="74" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <rect x="20" y="20" width="120" height="50" fill="#eeebe6" stroke="#888" strokeWidth="1" strokeDasharray="4 2"/>
      <line x1="8" y1="8" x2="20" y2="20" stroke="#888" strokeWidth="0.8"/>
      <line x1="152" y1="8" x2="140" y2="20" stroke="#888" strokeWidth="0.8"/>
      <line x1="8" y1="82" x2="20" y2="70" stroke="#888" strokeWidth="0.8"/>
      <line x1="152" y1="82" x2="140" y2="70" stroke="#888" strokeWidth="0.8"/>
      <text x="80" y="49" textAnchor="middle" fontSize="7" fill="#888">5 faces</text>
    </svg>
  )
}

function SvgPiaL() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 18 L110 18 L110 52 L46 52 L46 80 L10 80 Z" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="miter"/>
      <text x="60" y="38" textAnchor="middle" fontSize="7" fill="#888">seg1</text>
      <text x="28" y="68" textAnchor="middle" fontSize="7" fill="#888">seg2</text>
    </svg>
  )
}

function SvgPiaU() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 L40 10 L40 62 L120 62 L120 10 L150 10 L150 80 L10 80 Z" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="miter"/>
      <text x="25" y="50" textAnchor="middle" fontSize="7" fill="#888">seg1</text>
      <text x="80" y="75" textAnchor="middle" fontSize="7" fill="#888">seg2</text>
      <text x="135" y="50" textAnchor="middle" fontSize="7" fill="#888">seg3</text>
    </svg>
  )
}

function SvgLavatorioExtensao() {
  return (
    <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="18" width="96" height="54" fill="#f8f7f4" stroke="#1a1a1a" strokeWidth="2"/>
      <ellipse cx="56" cy="45" rx="28" ry="17" fill="none" stroke="#3498db" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="56" y="49" textAnchor="middle" fontSize="7" fill="#3498db">cuba</text>
      <rect x="104" y="18" width="48" height="54" fill="#fef0e6" stroke="#e67e22" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="128" y="48" textAnchor="middle" fontSize="7" fill="#e67e22">ext</text>
    </svg>
  )
}

const SVG_MAP: Record<string, React.ReactNode> = {
  bancada_simples: <SvgBancadaSimples />,
  bancada_cuba: <SvgBancadaCuba />,
  bancada_saia: <SvgBancadaSaia />,
  bancada_frontao: <SvgBancadaFrontao />,
  ilha_cozinha: <SvgIlhaCozinha />,
  escada: <SvgEscada />,
  soleira: <SvgSoleira />,
  nicho: <SvgNicho />,
  pia_l: <SvgPiaL />,
  pia_u: <SvgPiaU />,
  lavatorio_extensao: <SvgLavatorioExtensao />,
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SeletorPecaState {
  tipo_peca: string
  tem_saia: boolean
  altura_saia: number
  tem_frontao: boolean
  altura_frontao: number
  dados_extras: Record<string, unknown>
}

interface Props extends SeletorPecaState {
  showErrors: boolean
  onChange: (updates: Partial<SeletorPecaState>) => void
}

export default function SeletorPeca(props: Props) {
  const { tipo_peca, tem_saia, altura_saia, tem_frontao, altura_frontao, dados_extras, showErrors, onChange } = props

  function setExtra(key: string, val: unknown) {
    onChange({ dados_extras: { ...dados_extras, [key]: val } })
  }

  const peca = tipo_peca as TipoPeca

  return (
    <div>
      <div className="peca-grid">
        {Object.entries(PECA_LABELS).map(([id, nome]) => {
          const selected = tipo_peca === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ tipo_peca: id, tem_saia: false, altura_saia: 0, tem_frontao: false, altura_frontao: 0, dados_extras: {} })}
              style={{
                background: selected ? '#fef8ec' : '#fff',
                border: `2px solid ${selected ? 'var(--gold)' : '#EDE9E2'}`,
                borderRadius: 8,
                padding: '8px 6px 6px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ width: '100%' }}>{SVG_MAP[id]}</div>
              <div style={{ fontSize: 10, fontWeight: selected ? 700 : 500, marginTop: 4, color: selected ? 'var(--dark)' : '#666', lineHeight: 1.2 }}>
                {nome}
              </div>
            </button>
          )
        })}
      </div>

      {showErrors && !tipo_peca && (
        <Err msg="Selecione uma peça." />
      )}

      {tipo_peca && (
        <div style={{ marginTop: 12, padding: 14, background: '#f9f7f3', border: '1px solid #EDE9E2', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Bancada c/ Cuba — tipo de cuba */}
          {peca === 'bancada_cuba' && (
            <div className="form-group">
              <label className="form-label">TIPO DE CUBA</label>
              <select className="form-select" value={(dados_extras.tipo_cuba as string) || ''}
                onChange={e => setExtra('tipo_cuba', e.target.value)}>
                <option value="">Selecionar...</option>
                <option value="embutir">Cuba de embutir</option>
                <option value="apoio">Cuba de apoio</option>
                <option value="esculpida">Cuba esculpida na pedra</option>
              </select>
              {showErrors && !dados_extras.tipo_cuba && <Err msg="Informe o tipo de cuba." />}
            </div>
          )}

          {/* Bancada c/ Saia — altura obrigatória */}
          {peca === 'bancada_saia' && (
            <div className="form-group">
              <label className="form-label">ALTURA DA SAIA (cm)</label>
              <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 60"
                value={(dados_extras.altura_saia as number) || ''}
                onChange={e => setExtra('altura_saia', parseFloat(e.target.value) || 0)} />
              {showErrors && !((dados_extras.altura_saia as number) > 0) && <Err msg="Informe a altura da saia." />}
            </div>
          )}

          {/* Bancada c/ Frontão — altura obrigatória */}
          {peca === 'bancada_frontao' && (
            <div className="form-group">
              <label className="form-label">ALTURA DO FRONTÃO (cm)</label>
              <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 60"
                value={(dados_extras.altura_frontao as number) || ''}
                onChange={e => setExtra('altura_frontao', parseFloat(e.target.value) || 0)} />
              {showErrors && !((dados_extras.altura_frontao as number) > 0) && <Err msg="Informe a altura do frontão." />}
            </div>
          )}

          {/* Escada */}
          {peca === 'escada' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Nº DE DEGRAUS</label>
                <input className="form-input" type="number" min="1" step="1" placeholder="Ex: 10"
                  value={(dados_extras.num_degraus as number) || ''}
                  onChange={e => setExtra('num_degraus', parseInt(e.target.value) || 0)} />
                {showErrors && !((dados_extras.num_degraus as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">LARGURA DO PISO (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 30"
                  value={(dados_extras.largura_piso as number) || ''}
                  onChange={e => setExtra('largura_piso', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.largura_piso as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">ALTURA DO ESPELHO (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 18"
                  value={(dados_extras.altura_espelho as number) || ''}
                  onChange={e => setExtra('altura_espelho', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.altura_espelho as number) > 0) && <Err msg="Obrigatório." />}
              </div>
            </div>
          )}

          {/* Soleira / Peitoril */}
          {peca === 'soleira' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">COMPRIMENTO (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 150"
                  value={(dados_extras.comprimento as number) || ''}
                  onChange={e => setExtra('comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">LARGURA (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 20"
                  value={(dados_extras.largura as number) || ''}
                  onChange={e => setExtra('largura', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.largura as number) > 0) && <Err msg="Obrigatório." />}
              </div>
            </div>
          )}

          {/* Nicho */}
          {peca === 'nicho' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">LARGURA (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 60"
                  value={(dados_extras.largura as number) || ''}
                  onChange={e => setExtra('largura', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.largura as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">ALTURA (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 30"
                  value={(dados_extras.altura_nicho as number) || ''}
                  onChange={e => setExtra('altura_nicho', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.altura_nicho as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">PROFUNDIDADE (cm)</label>
                <input className="form-input" type="number" min="1" step="0.1" placeholder="Ex: 20"
                  value={(dados_extras.profundidade as number) || ''}
                  onChange={e => setExtra('profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
            </div>
          )}

          {/* Pia em L */}
          {peca === 'pia_l' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">SEG1 — COMPRIMENTO (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 2.00"
                  value={(dados_extras.seg1_comprimento as number) || ''}
                  onChange={e => setExtra('seg1_comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg1_comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG1 — PROFUNDIDADE (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                  value={(dados_extras.seg1_profundidade as number) || ''}
                  onChange={e => setExtra('seg1_profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg1_profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG2 — COMPRIMENTO (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 1.20"
                  value={(dados_extras.seg2_comprimento as number) || ''}
                  onChange={e => setExtra('seg2_comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg2_comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG2 — PROFUNDIDADE (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                  value={(dados_extras.seg2_profundidade as number) || ''}
                  onChange={e => setExtra('seg2_profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg2_profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
            </div>
          )}

          {/* Pia em U */}
          {peca === 'pia_u' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">SEG1 — COMPRIMENTO (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 1.00"
                  value={(dados_extras.seg1_comprimento as number) || ''}
                  onChange={e => setExtra('seg1_comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg1_comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG1 — PROFUNDIDADE (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                  value={(dados_extras.seg1_profundidade as number) || ''}
                  onChange={e => setExtra('seg1_profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg1_profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG2 — COMPRIMENTO (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 2.00"
                  value={(dados_extras.seg2_comprimento as number) || ''}
                  onChange={e => setExtra('seg2_comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg2_comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG2 — PROFUNDIDADE (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                  value={(dados_extras.seg2_profundidade as number) || ''}
                  onChange={e => setExtra('seg2_profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg2_profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG3 — COMPRIMENTO (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 1.00"
                  value={(dados_extras.seg3_comprimento as number) || ''}
                  onChange={e => setExtra('seg3_comprimento', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg3_comprimento as number) > 0) && <Err msg="Obrigatório." />}
              </div>
              <div className="form-group">
                <label className="form-label">SEG3 — PROFUNDIDADE (m)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                  value={(dados_extras.seg3_profundidade as number) || ''}
                  onChange={e => setExtra('seg3_profundidade', parseFloat(e.target.value) || 0)} />
                {showErrors && !((dados_extras.seg3_profundidade as number) > 0) && <Err msg="Obrigatório." />}
              </div>
            </div>
          )}

          {/* Lavatório c/ Extensão */}
          {peca === 'lavatorio_extensao' && (
            <>
              <div className="form-group">
                <label className="form-label">EXTENSÃO</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['esquerda', 'direita'] as const).map(lado => {
                    const sel = ((dados_extras.extensao_lado as string) || 'direita') === lado
                    return (
                      <button key={lado} type="button"
                        onClick={() => setExtra('extensao_lado', lado)}
                        style={{
                          padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `2px solid ${sel ? 'var(--gold)' : '#EDE9E2'}`,
                          background: sel ? '#fef8ec' : '#fff',
                          color: sel ? 'var(--dark)' : '#888',
                        }}>
                        {lado === 'esquerda' ? '← Esquerda' : 'Direita →'}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">COMPRIMENTO DO TAMPO (m)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 1.20"
                    value={(dados_extras.comp_tampo as number) || ''}
                    onChange={e => setExtra('comp_tampo', parseFloat(e.target.value) || 0)} />
                  {showErrors && !((dados_extras.comp_tampo as number) > 0) && <Err msg="Obrigatório." />}
                </div>
                <div className="form-group">
                  <label className="form-label">PROFUNDIDADE (m)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.55"
                    value={(dados_extras.profundidade as number) || ''}
                    onChange={e => setExtra('profundidade', parseFloat(e.target.value) || 0)} />
                  {showErrors && !((dados_extras.profundidade as number) > 0) && <Err msg="Obrigatório." />}
                </div>
                <div className="form-group">
                  <label className="form-label">COMPRIMENTO DA EXTENSÃO (m)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.60"
                    value={(dados_extras.comp_extensao as number) || ''}
                    onChange={e => setExtra('comp_extensao', parseFloat(e.target.value) || 0)} />
                  {showErrors && !((dados_extras.comp_extensao as number) > 0) && <Err msg="Obrigatório." />}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox"
                  checked={!!(dados_extras.cuba_pedra as boolean)}
                  onChange={e => {
                    setExtra('cuba_pedra', e.target.checked)
                    setExtra('valor_cuba_pedra', e.target.checked ? 350 : 0)
                  }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Cuba de pedra <span style={{ color: '#888', fontWeight: 400 }}>(+ R$ 350,00)</span>
                </span>
              </label>
            </>
          )}

          {/* Toggle saia (optional, for pieces that allow it) */}
          {['bancada_simples', 'bancada_cuba', 'bancada_frontao', 'ilha_cozinha'].includes(peca) && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <Toggle on={tem_saia} onToggle={() => onChange({ tem_saia: !tem_saia, altura_saia: !tem_saia ? 0.10 : 0 })} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Possui saia?</span>
              </label>
              {tem_saia && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">ALTURA DA SAIA (m)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.10"
                    value={altura_saia || ''}
                    onChange={e => onChange({ altura_saia: parseFloat(e.target.value) || 0 })} />
                  {showErrors && !(altura_saia > 0) && <Err msg="Informe a altura da saia." />}
                </div>
              )}
            </div>
          )}

          {/* Toggle frontão (optional) */}
          {['bancada_simples', 'bancada_cuba', 'bancada_saia', 'ilha_cozinha'].includes(peca) && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <Toggle on={tem_frontao} onToggle={() => onChange({ tem_frontao: !tem_frontao, altura_frontao: !tem_frontao ? 0.10 : 0 })} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Possui frontão?</span>
              </label>
              {tem_frontao && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">ALTURA DO FRONTÃO (m)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="Ex: 0.10"
                    value={altura_frontao || ''}
                    onChange={e => onChange({ altura_frontao: parseFloat(e.target.value) || 0 })} />
                  {showErrors && !(altura_frontao > 0) && <Err msg="Informe a altura do frontão." />}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

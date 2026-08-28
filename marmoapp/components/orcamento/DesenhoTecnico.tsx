'use client'

// Desenho técnico gerado a partir dos dados digitados no orçamento (não é upload
// de imagem). Recebe os mesmos campos usados em calcArea() das telas de orçamento
// e desenha a peça em escala, com as medidas reais anotadas.
//
// Reutilizável: os mesmos parâmetros (tipo_peca + dimensões + dados_extras) são
// o que vai virar `desenho_tipo`/`desenho_params` salvos em orcamento_itens, e
// é a base pro desenho que o instalador vai ver no portal (item 5 do backlog).

export interface DesenhoTecnicoParams {
  tipo_peca: string
  largura?: number
  altura?: number
  dados_extras?: Record<string, unknown>
  acabamento_esquerda?: string
  acabamento_direita?: string
  acabamento_frente?: string
  acabamento_fundo?: string
  tem_saia?: boolean
  altura_saia?: number
  tem_frontao?: boolean
  altura_frontao?: number
}

const STROKE = '#1a1a1a'
const FILL = '#f8f7f4'
const DIM_COLOR = '#8a8a8a'
const LABEL_COLOR = '#555'
const CUBA_COLOR = '#3498db'

function fmtM(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' m'
}
function fmtCm(v: number): string {
  return Math.round(v * 100) + ' cm'
}

// ── Linhas de cota (horizontal / vertical), em coordenadas já em px ──────────

function DimH({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM_COLOR} strokeWidth="1" />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={DIM_COLOR} strokeWidth="1" />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={DIM_COLOR} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize="9.5" fill={LABEL_COLOR}>{label}</text>
    </g>
  )
}

function DimV({ y1, y2, x, label }: { y1: number; y2: number; x: number; label: string }) {
  const my = (y1 + y2) / 2
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM_COLOR} strokeWidth="1" />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke={DIM_COLOR} strokeWidth="1" />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke={DIM_COLOR} strokeWidth="1" />
      <text x={x - 7} y={my} textAnchor="middle" fontSize="9.5" fill={LABEL_COLOR} transform={`rotate(-90, ${x - 7}, ${my})`}>{label}</text>
    </g>
  )
}

// Legenda textual com as configurações que não cabem no desenho (saia/frontão
// por lado, profundidade de nicho etc.) — mesmo padrão de listas já usado no
// resto do sistema.
function Notas({ notas }: { notas: string[] }) {
  if (notas.length === 0) return null
  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
      {notas.map((n, i) => (
        <span key={i} style={{ fontSize: 11, color: 'var(--gray)' }}>• {n}</span>
      ))}
    </div>
  )
}

function notasLaterais(dimMap: Record<string, number>, acabs: Record<string, string>, ex: Record<string, unknown>, nomes: Record<string, string>): string[] {
  const notas: string[] = []
  for (const [lat, len] of Object.entries(dimMap)) {
    if (len <= 0) continue
    const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
    const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
    if ((ex[`saia_${lat}`] as boolean) && altSaia > 0) notas.push(`${nomes[lat] || lat}: saia ${fmtCm(altSaia)}`)
    if (acabs[lat] === 'frontao' && altFrontao > 0) notas.push(`${nomes[lat] || lat}: frontão ${fmtCm(altFrontao)}`)
  }
  return notas
}

const NOME_LATERAL: Record<string, string> = {
  frente: 'Frente', fundo: 'Fundo', esquerda: 'Esquerda', direita: 'Direita',
  frente_seg1: 'Frente seg.1', frente_seg2: 'Frente seg.2', frente_seg3: 'Frente seg.3',
}

// ── Retângulo simples (bancada, lavatório, pia retangular) ───────────────────

function DesenhoRetangulo({ w, h, cuba, qtdCuba, notas }: { w: number; h: number; cuba: boolean; qtdCuba: number; notas: string[] }) {
  if (!w || !h) return null
  const boxW = 220, boxH = 140
  const scale = Math.min(boxW / w, boxH / h)
  const pw = w * scale, ph = h * scale
  const marginL = 40, marginT = 24, marginR = 16, marginB = 16
  const viewW = pw + marginL + marginR
  const viewH = ph + marginT + marginB
  const x0 = marginL, y0 = marginT
  const cubaLabel = qtdCuba > 1 ? `${qtdCuba}× cuba` : 'cuba'

  return (
    <div>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 340 }} xmlns="http://www.w3.org/2000/svg">
        <rect x={x0} y={y0} width={pw} height={ph} fill={FILL} stroke={STROKE} strokeWidth="2" />
        {cuba && (
          <>
            <ellipse cx={x0 + pw / 2} cy={y0 + ph / 2} rx={pw * 0.3} ry={ph * 0.28} fill="none" stroke={CUBA_COLOR} strokeWidth="1.5" strokeDasharray="4 2" />
            <text x={x0 + pw / 2} y={y0 + ph / 2 + 3} textAnchor="middle" fontSize="9" fill={CUBA_COLOR}>{cubaLabel}</text>
          </>
        )}
        <DimH x1={x0} x2={x0 + pw} y={y0 - 8} label={fmtM(w)} />
        <DimV y1={y0} y2={y0 + ph} x={x0 - 8} label={fmtM(h)} />
      </svg>
      <Notas notas={notas} />
    </div>
  )
}

// ── Lavatório com extensão ────────────────────────────────────────────────────

function DesenhoLavatorioExtensao({ compTampo, compExtensao, prof, ladoExtensao, cuba, qtdCuba, notas }: {
  compTampo: number; compExtensao: number; prof: number; ladoExtensao: string; cuba: boolean; qtdCuba: number; notas: string[]
}) {
  if (!compTampo || !prof) return null
  const wTotal = compTampo + compExtensao
  const boxW = 240, boxH = 130
  const scale = Math.min(boxW / (wTotal || compTampo), boxH / prof)
  const pTampo = compTampo * scale, pExt = compExtensao * scale, ph = prof * scale
  const marginL = 40, marginT = 24, marginR = 16, marginB = 16
  const viewW = pTampo + pExt + marginL + marginR
  const viewH = ph + marginT + marginB
  const y0 = marginT
  const xTampo = ladoExtensao === 'esquerda' ? marginL + pExt : marginL
  const xExt = ladoExtensao === 'esquerda' ? marginL : marginL + pTampo
  const cubaLabel = qtdCuba > 1 ? `${qtdCuba}× cuba` : 'cuba'

  return (
    <div>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 360 }} xmlns="http://www.w3.org/2000/svg">
        <rect x={xTampo} y={y0} width={pTampo} height={ph} fill={FILL} stroke={STROKE} strokeWidth="2" />
        {pExt > 0 && <rect x={xExt} y={y0} width={pExt} height={ph} fill="#fef0e6" stroke="#e67e22" strokeWidth="1.5" strokeDasharray="5 3" />}
        {cuba && (
          <>
            <ellipse cx={xTampo + pTampo / 2} cy={y0 + ph / 2} rx={pTampo * 0.28} ry={ph * 0.26} fill="none" stroke={CUBA_COLOR} strokeWidth="1.5" strokeDasharray="4 2" />
            <text x={xTampo + pTampo / 2} y={y0 + ph / 2 + 3} textAnchor="middle" fontSize="9" fill={CUBA_COLOR}>{cubaLabel}</text>
          </>
        )}
        {pExt > 0 && <text x={xExt + pExt / 2} y={y0 + ph / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#e67e22">ext.</text>}
        <DimH x1={xTampo} x2={xTampo + pTampo} y={y0 - 8} label={fmtM(compTampo)} />
        {pExt > 0 && <DimH x1={xExt} x2={xExt + pExt} y={y0 + ph + 16} label={fmtM(compExtensao)} />}
        <DimV y1={y0} y2={y0 + ph} x={marginL - 8} label={fmtM(prof)} />
      </svg>
      <Notas notas={notas} />
    </div>
  )
}

// ── Soleira / peitoril (peça linear) ─────────────────────────────────────────

function DesenhoSoleira({ comp, larg }: { comp: number; larg: number }) {
  if (!comp || !larg) return null
  const boxW = 240
  const scale = Math.min(boxW / comp, 40 / larg)
  const pw = comp * scale, ph = Math.max(larg * scale, 14)
  const marginL = 40, marginT = 24, marginR = 16, marginB = 16
  const viewW = pw + marginL + marginR
  const viewH = ph + marginT + marginB
  const x0 = marginL, y0 = marginT
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 340 }} xmlns="http://www.w3.org/2000/svg">
      <rect x={x0} y={y0} width={pw} height={ph} fill={FILL} stroke={STROKE} strokeWidth="2" />
      <DimH x1={x0} x2={x0 + pw} y={y0 - 8} label={fmtM(comp)} />
      <DimV y1={y0} y2={y0 + ph} x={x0 - 8} label={fmtM(larg)} />
    </svg>
  )
}

// ── Nicho (vista de frente; profundidade anotada em legenda) ────────────────

function DesenhoNicho({ largura, altura, profundidade, temFundo, notas }: { largura: number; altura: number; profundidade: number; temFundo: boolean; notas: string[] }) {
  if (!largura || !altura) return null
  const boxW = 200, boxH = 150
  const scale = Math.min(boxW / largura, boxH / altura)
  const pw = largura * scale, ph = altura * scale
  const marginL = 40, marginT = 24, marginR = 16, marginB = 16
  const viewW = pw + marginL + marginR
  const viewH = ph + marginT + marginB
  const x0 = marginL, y0 = marginT
  return (
    <div>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 320 }} xmlns="http://www.w3.org/2000/svg">
        <rect x={x0} y={y0} width={pw} height={ph} fill={temFundo ? '#eeebe6' : FILL} stroke={STROKE} strokeWidth="2" strokeDasharray={temFundo ? undefined : '4 2'} />
        <DimH x1={x0} x2={x0 + pw} y={y0 - 8} label={fmtM(largura)} />
        <DimV y1={y0} y2={y0 + ph} x={x0 - 8} label={fmtM(altura)} />
      </svg>
      <Notas notas={[`Profundidade: ${fmtM(profundidade)}`, ...notas]} />
    </div>
  )
}

// ── Escada ─────────────────────────────────────────────────────────────────

function DesenhoEscada({ largura, numDegraus, larguraPiso, alturaEspelho }: { largura: number; numDegraus: number; larguraPiso: number; alturaEspelho: number }) {
  if (!numDegraus || !larguraPiso || !alturaEspelho) return null
  const n = Math.min(numDegraus, 14) // limite visual — evita degraus ilegíveis com muitos steps
  const stepW = 22, stepH = 16
  const marginL = 44, marginT = 20, marginR = 16, marginB = 34
  const pw = n * stepW
  const ph = n * stepH
  const viewW = pw + marginL + marginR
  const viewH = ph + marginT + marginB
  const baseY = marginT + ph
  let d = `M ${marginL} ${baseY}`
  for (let i = 0; i < n; i++) {
    const x = marginL + i * stepW
    const yTop = baseY - (i + 1) * stepH
    d += ` L ${x} ${yTop} L ${x + stepW} ${yTop}`
  }
  d += ` L ${marginL + n * stepW} ${baseY} Z`
  return (
    <div>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 360 }} xmlns="http://www.w3.org/2000/svg">
        <path d={d} fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="miter" />
        <DimH x1={marginL} x2={marginL + stepW} y={baseY + 14} label={fmtCm(larguraPiso)} />
        <DimV y1={baseY - stepH} y2={baseY} x={marginL - 10} label={fmtCm(alturaEspelho)} />
      </svg>
      <Notas notas={[
        `${numDegraus} degraus`,
        `Largura da peça: ${fmtM(largura)}`,
        ...(numDegraus > 14 ? ['Desenho simplificado — mostrando 14 de ' + numDegraus + ' degraus'] : []),
      ]} />
    </div>
  )
}

// ── Pia em L ──────────────────────────────────────────────────────────────────

function DesenhoPiaL({ seg1c, seg1p, seg2c, seg2p }: { seg1c: number; seg1p: number; seg2c: number; seg2p: number }) {
  if (!seg1c || !seg1p || !seg2c || !seg2p) return null
  const wTotal = seg1c, hTotal = seg1p + seg2p
  const boxW = 220, boxH = 160
  const scale = Math.min(boxW / wTotal, boxH / hTotal)
  const marginL = 40, marginT = 24
  const x0 = marginL, y0 = marginT
  const s1c = seg1c * scale, s1p = seg1p * scale, s2c = seg2c * scale, s2p = seg2p * scale
  const viewW = s1c + marginL + 16
  const viewH = s1p + s2p + marginT + 16
  const d = `M ${x0} ${y0} L ${x0 + s1c} ${y0} L ${x0 + s1c} ${y0 + s1p + s2p} L ${x0 + s1c - s2c} ${y0 + s1p + s2p} L ${x0 + s1c - s2c} ${y0 + s1p} L ${x0} ${y0 + s1p} Z`
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 340 }} xmlns="http://www.w3.org/2000/svg">
      <path d={d} fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="miter" />
      <DimH x1={x0} x2={x0 + s1c} y={y0 - 8} label={`seg1 ${fmtM(seg1c)}`} />
      <DimV y1={y0} y2={y0 + s1p} x={x0 - 8} label={fmtM(seg1p)} />
      <DimV y1={y0 + s1p} y2={y0 + s1p + s2p} x={x0 + s1c - s2c - 8} label={`seg2 ${fmtM(seg2p)}`} />
      <DimH x1={x0 + s1c - s2c} x2={x0 + s1c} y={y0 + s1p + s2p + 16} label={fmtM(seg2c)} />
    </svg>
  )
}

// ── Pia em U ──────────────────────────────────────────────────────────────────

function DesenhoPiaU({ seg1c, seg1p, seg2c, seg2p, seg3c, seg3p }: { seg1c: number; seg1p: number; seg2c: number; seg2p: number; seg3c: number; seg3p: number }) {
  if (!seg1c || !seg1p || !seg2c || !seg2p || !seg3c || !seg3p) return null
  const wTotal = seg1p + seg2c + seg3p
  const hTotal = Math.max(seg1c, seg3c)
  const boxW = 240, boxH = 160
  const scale = Math.min(boxW / wTotal, boxH / hTotal)
  const marginL = 40, marginT = 24
  const x0 = marginL, y0 = marginT
  const s1p = seg1p * scale, s1c = seg1c * scale, s2c = seg2c * scale, s2p = seg2p * scale, s3p = seg3p * scale, s3c = seg3c * scale
  const hMax = Math.max(s1c, s3c)
  const viewW = s1p + s2c + s3p + marginL + 16
  const viewH = hMax + marginT + 24
  // Braços (seg1/seg3) alinhados pela base (fundo do U); a peça de ligação
  // (seg2) fecha a base entre eles. Alinhamento pela base — cada braço "sobe"
  // sua própria altura a partir do fundo comum.
  const baseY = y0 + hMax
  const d = `M ${x0} ${baseY - s1c}` +
    ` L ${x0 + s1p} ${baseY - s1c}` +
    ` L ${x0 + s1p} ${baseY - s2p}` +
    ` L ${x0 + s1p + s2c} ${baseY - s2p}` +
    ` L ${x0 + s1p + s2c} ${baseY - s3c}` +
    ` L ${x0 + s1p + s2c + s3p} ${baseY - s3c}` +
    ` L ${x0 + s1p + s2c + s3p} ${baseY}` +
    ` L ${x0} ${baseY} Z`
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: 360 }} xmlns="http://www.w3.org/2000/svg">
      <path d={d} fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="miter" />
      <DimV y1={baseY - s1c} y2={baseY} x={x0 - 8} label={`seg1 ${fmtM(seg1c)}`} />
      <DimH x1={x0} x2={x0 + s1p} y={baseY + 16} label={fmtM(seg1p)} />
      <DimH x1={x0 + s1p} x2={x0 + s1p + s2c} y={baseY - s2p - 6} label={`seg2 ${fmtM(seg2c)}`} />
      <DimV y1={baseY - s3c} y2={baseY} x={x0 + s1p + s2c + s3p + 8} label={`seg3 ${fmtM(seg3c)}`} />
    </svg>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function DesenhoTecnico({ params }: { params: DesenhoTecnicoParams }) {
  const { tipo_peca, dados_extras, acabamento_esquerda, acabamento_direita, acabamento_frente, acabamento_fundo } = params
  const ex = dados_extras || {}
  const acabs: Record<string, string> = { frente: acabamento_frente || '', fundo: acabamento_fundo || '', esquerda: acabamento_esquerda || '', direita: acabamento_direita || '' }

  switch (tipo_peca) {
    case 'bancada_simples': {
      const w = params.largura || 0, h = params.altura || 0
      const dimMap = { frente: w, fundo: w, esquerda: h, direita: h }
      return <DesenhoRetangulo w={w} h={h} cuba={false} qtdCuba={0} notas={notasLaterais(dimMap, acabs, ex, NOME_LATERAL)} />
    }
    case 'lavatorio_simples': {
      const w = (ex.comprimento as number) || 0, h = (ex.profundidade as number) || 0
      const dimMap = { frente: w, fundo: w, esquerda: h, direita: h }
      return <DesenhoRetangulo w={w} h={h} cuba={!!ex.cuba_pedra} qtdCuba={(ex.qtd_cuba_pedra as number) || 1} notas={notasLaterais(dimMap, acabs, ex, NOME_LATERAL)} />
    }
    case 'pia_retangular': {
      const w = (ex.largura as number) || 0, h = (ex.profundidade as number) || 0
      const dimMap = { frente: w, fundo: w, esquerda: h, direita: h }
      return <DesenhoRetangulo w={w} h={h} cuba={!!ex.cuba_pedra} qtdCuba={(ex.qtd_cuba_pedra as number) || 1} notas={notasLaterais(dimMap, acabs, ex, NOME_LATERAL)} />
    }
    case 'lavatorio_extensao': {
      const compTampo = (ex.comp_tampo as number) || 0
      const compExtensao = (ex.comp_extensao as number) || 0
      const prof = (ex.profundidade as number) || 0
      const lado = (ex.extensao_lado as string) || 'direita'
      const totalWidth = compTampo + compExtensao
      const dimMap = { frente: totalWidth, fundo: totalWidth, esquerda: prof, direita: prof }
      return <DesenhoLavatorioExtensao compTampo={compTampo} compExtensao={compExtensao} prof={prof} ladoExtensao={lado} cuba={!!ex.cuba_pedra} qtdCuba={(ex.qtd_cuba_pedra as number) || 1} notas={notasLaterais(dimMap, acabs, ex, NOME_LATERAL)} />
    }
    case 'soleira':
      return <DesenhoSoleira comp={(ex.comprimento as number) || 0} larg={(ex.largura as number) || 0} />
    case 'nicho':
      return <DesenhoNicho
        largura={(ex.largura as number) || 0}
        altura={(ex.altura as number) || 0}
        profundidade={(ex.profundidade as number) || 0}
        temFundo={!!ex.tem_fundo}
        notas={ex.tem_saia_nicho ? [`Saia: ${fmtCm((ex.altura_saia_nicho as number) || 0)}`] : []}
      />
    case 'escada':
      return <DesenhoEscada
        largura={params.largura || 0}
        numDegraus={(ex.num_degraus as number) || 0}
        larguraPiso={((ex.largura_piso as number) || 0) / 100}
        alturaEspelho={((ex.altura_espelho as number) || 0) / 100}
      />
    case 'pia_l':
      return <DesenhoPiaL
        seg1c={(ex.seg1_comprimento as number) || 0}
        seg1p={(ex.seg1_profundidade as number) || 0}
        seg2c={(ex.seg2_comprimento as number) || 0}
        seg2p={(ex.seg2_profundidade as number) || 0}
      />
    case 'pia_u':
      return <DesenhoPiaU
        seg1c={(ex.seg1_comprimento as number) || 0}
        seg1p={(ex.seg1_profundidade as number) || 0}
        seg2c={(ex.seg2_comprimento as number) || 0}
        seg2p={(ex.seg2_profundidade as number) || 0}
        seg3c={(ex.seg3_comprimento as number) || 0}
        seg3p={(ex.seg3_profundidade as number) || 0}
      />
    default:
      return null
  }
}

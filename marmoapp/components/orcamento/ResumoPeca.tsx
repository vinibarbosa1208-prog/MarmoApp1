'use client'

import { fmt, mlAcabamentoItem } from '@/lib/utils'

// Mesmas peças calculadas em calcArea (novo/editar orçamento) e no cálculo
// de ml de acabamento (lib/utils.ts). Este componente não recalcula nada
// que é salvo — é só a prévia visual enquanto a peça está sendo preenchida,
// pra mostrar ao usuário a mesma área/acabamento que vai ser gravado.
export interface ResumoPecaItem {
  tipo_peca: string
  dados_extras: Record<string, unknown>
  largura: number
  altura: number
  quantidade: number
  preco_unitario: number
  custo_m2: number
  acabamento_esquerda: string
  acabamento_direita: string
  acabamento_frente: string
  acabamento_fundo: string
}

interface Row {
  label: string
  calc: string
  value: number
}

interface Resumo {
  rows: Row[]
  base: number
  dimMap: Record<string, number>
  acabs: Record<string, string>
  latLabels: Record<string, string>
}

const d = (n: number) => (n || 0).toFixed(2).replace('.', ',')

function montarResumo(item: ResumoPecaItem): Resumo | null {
  const ex = item.dados_extras || {}

  if (item.tipo_peca === 'lavatorio_simples' || item.tipo_peca === 'lavatorio_extensao') {
    const isSim = item.tipo_peca === 'lavatorio_simples'
    const comp = isSim
      ? ((ex.comprimento as number) || 0)
      : ((ex.comp_tampo as number) || 0) + ((ex.comp_extensao as number) || 0)
    const prof = (ex.profundidade as number) || 0
    if (!comp || !prof) return null
    const tampo = comp * prof
    return {
      rows: [{ label: 'Tampo', calc: `${d(comp)} × ${d(prof)}`, value: tampo }],
      base: tampo,
      dimMap: { frente: comp, fundo: comp, esquerda: prof, direita: prof },
      acabs: { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita },
      latLabels: { frente: 'Frente', fundo: 'Fundo', esquerda: 'Esq.', direita: 'Dir.' },
    }
  }

  if (item.tipo_peca === 'pia_retangular') {
    const largura = (ex.largura as number) || 0
    const profundidade = (ex.profundidade as number) || 0
    if (!largura || !profundidade) return null
    const tampo = largura * profundidade
    return {
      rows: [{ label: 'Tampo', calc: `${d(largura)} × ${d(profundidade)}`, value: tampo }],
      base: tampo,
      dimMap: { frente: largura, fundo: largura, esquerda: profundidade, direita: profundidade },
      acabs: { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita },
      latLabels: { frente: 'Frente', fundo: 'Fundo', esquerda: 'Esq.', direita: 'Dir.' },
    }
  }

  if (item.tipo_peca === 'soleira') {
    const comp = (ex.comprimento as number) || 0
    const larg = (ex.largura as number) || 0
    if (!comp || !larg) return null
    const area = comp * larg
    return {
      rows: [{ label: 'Área', calc: `${d(comp)} × ${d(larg)}`, value: area }],
      base: area,
      dimMap: { frente: comp, fundo: comp, esquerda: larg, direita: larg },
      acabs: { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita },
      latLabels: { frente: 'Frente', fundo: 'Fundo', esquerda: 'Esq.', direita: 'Dir.' },
    }
  }

  if (item.tipo_peca === 'nicho') {
    const l = (ex.largura as number) || 0
    const a = (ex.altura as number) || 0
    const p = (ex.profundidade as number) || 0
    if (!l || !a || !p) return null
    const aLat = 2 * p * a
    const aTB = 2 * l * p
    const aFundo = (ex.tem_fundo as boolean) ? l * a : 0
    const rows: Row[] = [
      { label: '2 Laterais', calc: `2 × ${d(p)} × ${d(a)}`, value: aLat },
      { label: 'Topo + Base', calc: `2 × ${d(l)} × ${d(p)}`, value: aTB },
    ]
    if (aFundo > 0) rows.push({ label: 'Fundo', calc: `${d(l)} × ${d(a)}`, value: aFundo })
    return {
      rows,
      base: aLat + aTB + aFundo,
      dimMap: { esquerda: a, direita: a, superior: l, inferior: l },
      acabs: {
        esquerda: item.acabamento_esquerda,
        direita: item.acabamento_direita,
        superior: (ex.acabamento_superior as string) || '',
        inferior: (ex.acabamento_inferior as string) || '',
      },
      latLabels: { esquerda: 'Esq.', direita: 'Dir.', superior: 'Superior', inferior: 'Inferior' },
    }
  }

  if (item.tipo_peca === 'pia_l') {
    const seg1c = (ex.seg1_comprimento as number) || 0
    const seg1p = (ex.seg1_profundidade as number) || 0
    const seg2c = (ex.seg2_comprimento as number) || 0
    const seg2p = (ex.seg2_profundidade as number) || 0
    if (!seg1c || !seg1p || !seg2c || !seg2p) return null
    return {
      rows: [
        { label: 'Segmento 1', calc: `${d(seg1c)} × ${d(seg1p)}`, value: seg1c * seg1p },
        { label: 'Segmento 2', calc: `${d(seg2c)} × ${d(seg2p)}`, value: seg2c * seg2p },
      ],
      base: seg1c * seg1p + seg2c * seg2p,
      dimMap: { esquerda: seg1p, direita: seg2p, frente_seg1: seg1c, frente_seg2: seg2c, fundo: seg1c },
      acabs: {
        esquerda: item.acabamento_esquerda,
        direita: item.acabamento_direita,
        fundo: item.acabamento_fundo,
        frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
        frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
      },
      latLabels: { esquerda: 'esq.', direita: 'dir.', fundo: 'fundo', frente_seg1: 'frente seg1', frente_seg2: 'frente seg2' },
    }
  }

  if (item.tipo_peca === 'pia_u') {
    const seg1c = (ex.seg1_comprimento as number) || 0
    const seg1p = (ex.seg1_profundidade as number) || 0
    const seg2c = (ex.seg2_comprimento as number) || 0
    const seg2p = (ex.seg2_profundidade as number) || 0
    const seg3c = (ex.seg3_comprimento as number) || 0
    const seg3p = (ex.seg3_profundidade as number) || 0
    if (!seg1c || !seg1p || !seg2c || !seg2p || !seg3c || !seg3p) return null
    return {
      rows: [
        { label: 'Segmento 1', calc: `${d(seg1c)} × ${d(seg1p)}`, value: seg1c * seg1p },
        { label: 'Segmento 2', calc: `${d(seg2c)} × ${d(seg2p)}`, value: seg2c * seg2p },
        { label: 'Segmento 3', calc: `${d(seg3c)} × ${d(seg3p)}`, value: seg3c * seg3p },
      ],
      base: seg1c * seg1p + seg2c * seg2p + seg3c * seg3p,
      dimMap: { esquerda: seg1p, direita: seg3p, frente_seg1: seg1c, frente_seg2: seg2c, frente_seg3: seg3c, fundo: seg2c },
      acabs: {
        esquerda: item.acabamento_esquerda,
        direita: item.acabamento_direita,
        fundo: item.acabamento_fundo,
        frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
        frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
        frente_seg3: (ex.acabamento_frente_seg3 as string) || '',
      },
      latLabels: { esquerda: 'esq.', direita: 'dir.', fundo: 'fundo', frente_seg1: 'frente seg1', frente_seg2: 'frente seg2', frente_seg3: 'frente seg3' },
    }
  }

  if (item.tipo_peca === 'escada') {
    const n = (ex.num_degraus as number) || 0
    const lp = (ex.largura_piso as number) || 0
    const ae = (ex.altura_espelho as number) || 0
    const w = item.largura || 0
    if (!n || !lp || !ae || !w) return null
    const piso = w * (lp / 100) * n
    const espelho = w * (ae / 100) * n
    const comprimentoLateral = n * (lp / 100)
    return {
      rows: [
        { label: 'Piso', calc: `${d(w)} × ${d(lp / 100)} × ${n} degraus`, value: piso },
        { label: 'Espelho', calc: `${d(w)} × ${d(ae / 100)} × ${n} degraus`, value: espelho },
      ],
      base: piso + espelho,
      dimMap: { esquerda: comprimentoLateral, direita: comprimentoLateral },
      acabs: { esquerda: item.acabamento_esquerda, direita: item.acabamento_direita },
      latLabels: { esquerda: 'Esq.', direita: 'Dir.' },
    }
  }

  if (item.tipo_peca === 'bancada_simples') {
    if (!item.largura || !item.altura) return null
    const tampo = item.largura * item.altura
    return {
      rows: [{ label: 'Tampo', calc: `${d(item.largura)} × ${d(item.altura)}`, value: tampo }],
      base: tampo,
      dimMap: { frente: item.largura, fundo: item.largura, esquerda: item.altura, direita: item.altura },
      acabs: { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita },
      latLabels: { frente: 'Frente', fundo: 'Fundo', esquerda: 'Esq.', direita: 'Dir.' },
    }
  }

  return null
}

export default function ResumoPeca({ item }: { item: ResumoPecaItem }) {
  const resumo = montarResumo(item)
  if (!resumo) return null

  const ex = item.dados_extras || {}
  const { rows, base, dimMap, acabs, latLabels } = resumo
  const extras: { label: string; area: number }[] = []
  let total = base
  for (const [lat, len] of Object.entries(dimMap)) {
    const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
    const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
    if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) {
      const area = len * altSaia
      extras.push({ label: `Saia ${latLabels[lat] || lat}`, area })
      total += area
    }
    if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) {
      const area = len * altFrontao
      extras.push({ label: `Frontão ${latLabels[lat] || lat}`, area })
      total += area
    }
  }

  const ml = mlAcabamentoItem(item)
  const totalVenda = total * item.quantidade * item.preco_unitario
  const totalCusto = total * item.quantidade * item.custo_m2

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--card-bg, #fff)', borderRadius: 8, border: '1px solid rgba(25,135,84,0.2)', fontSize: 13 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary, #555)' }}>{row.label}</span>
          <span style={{ fontFamily: 'monospace' }}>{row.calc} = <strong>{d(row.value)} m²</strong></span>
        </div>
      ))}
      {extras.map(({ label, area }, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted, #777)' }}>
          <span>{label}</span>
          <span style={{ fontFamily: 'monospace' }}><strong>{d(area)} m²</strong></span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>Total</span>
        <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
      </div>
      {ml > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--gold)', background: 'rgba(201,168,76,0.06)', border: '1px solid #E8D9B0', borderRadius: 6, padding: '5px 10px' }}>
          <span>Acabamento necessário</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d(ml)} ml (meia esquadria)</span>
        </div>
      )}
      {item.custo_m2 > 0 && (
        <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #888)', fontSize: 12, marginBottom: 3 }}>
            <span>Custo</span>
            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {item.custo_m2.toFixed(2)} = <strong>{fmt(totalCusto)}</strong></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gold)' }}>
            <span>Venda</span>
            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {item.preco_unitario.toFixed(2)} = <strong>{fmt(totalVenda)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

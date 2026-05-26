import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Marmoraria, Cliente } from '@/lib/types'

export interface ItemPDF {
  tipo: string
  descricao: string
  quantidade: number
  preco_unitario: number
  total_item: number
  largura?: number
  altura?: number
  area?: number
  tipo_peca?: string
  acabamento_esquerda?: string
  acabamento_direita?: string
  acabamento_frente?: string
  acabamento_fundo?: string
  tem_saia?: boolean
  altura_saia?: number
  tem_frontao?: boolean
  altura_frontao?: number
  dados_extras?: Record<string, unknown>
  variante?: string
  nome_variante?: string
}

export interface OrcamentoPDF {
  id: string
  numero?: number
  descricao?: string
  status: string
  mao_obra: number
  desconto_rs: number
  total: number
  observacoes?: string
  validade?: string
  created_at: string
  itens: ItemPDF[]
  tem_variantes?: boolean
  total_variante_a?: number
  total_variante_b?: number
  total_variante_c?: number
  nome_variante_a?: string
  nome_variante_b?: string
  nome_variante_c?: string
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PECA_LABELS_PDF: Record<string, string> = {
  bancada_simples: 'Bancada Simples', bancada_cuba: 'Bancada c/ Cuba',
  bancada_saia: 'Bancada c/ Saia', bancada_frontao: 'Bancada c/ Frontão',
  ilha_cozinha: 'Ilha de Cozinha', escada: 'Escada',
  soleira: 'Soleira / Peitoril', nicho: 'Nicho',
}
const ACAB_LABELS_PDF: Record<string, string> = {
  reto: 'Reto', boleado: 'Boleado', meia_esquadria: 'Meia Esquadria',
}
const LATERAL_LABELS_PDF: Record<string, string> = {
  esquerda: 'Esq', direita: 'Dir', frente: 'Frente', fundo: 'Fundo',
  superior: 'Sup', inferior: 'Inf',
}

function pecaDetalhe(i: ItemPDF): string {
  if (!i.tipo_peca) return ''
  const parts: string[] = [PECA_LABELS_PDF[i.tipo_peca] || i.tipo_peca]
  const acabs: string[] = []
  for (const lat of ['esquerda', 'direita', 'frente', 'fundo', 'superior', 'inferior']) {
    const v = (i as unknown as Record<string, unknown>)[`acabamento_${lat}`] as string | undefined
    if (v) {
      const raio = i.dados_extras?.[`raio_${lat}`] as number | undefined
      const lbl = ACAB_LABELS_PDF[v] || v
      acabs.push(`${LATERAL_LABELS_PDF[lat]}: ${lbl}${v === 'boleado' && raio ? ` R${raio}mm` : ''}`)
    }
  }
  if (acabs.length) parts.push(acabs.join(' | '))
  if (i.tem_saia && i.altura_saia) parts.push(`Saia: ${i.altura_saia}cm`)
  if (i.tem_frontao && i.altura_frontao) parts.push(`Frontão: ${i.altura_frontao}cm`)
  // piece-specific extras
  const ex = i.dados_extras
  if (ex) {
    if (ex.tipo_cuba) parts.push(`Cuba: ${ex.tipo_cuba}`)
    if (ex.num_degraus) parts.push(`${ex.num_degraus} degraus`)
    if (ex.largura_piso) parts.push(`Piso ${ex.largura_piso}cm`)
    if (ex.altura_espelho) parts.push(`Espelho ${ex.altura_espelho}cm`)
    if (ex.comprimento) parts.push(`${ex.comprimento}×${ex.largura || '?'}cm`)
  }
  return parts.join('\n')
}

function fmtNum(n: number | undefined, decimals = 2): string {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function orcNum(orc: OrcamentoPDF): string {
  const year = new Date(orc.created_at).getFullYear()
  const num = String(orc.numero ?? 0).padStart(4, '0')
  return `ORC-${year}-${num}`
}

function dataValidade(orc: OrcamentoPDF): string {
  if (orc.validade) {
    const d = new Date(orc.validade)
    return d.toLocaleDateString('pt-BR')
  }
  const d = new Date(orc.created_at)
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('pt-BR')
}

type LogoResult = { dataUrl: string; format: 'PNG' | 'JPEG' }

async function detectFormat(blob: Blob): Promise<'PNG' | 'JPEG'> {
  try {
    const buf = await blob.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(buf)
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'PNG'
  } catch { /* fall through */ }
  return 'JPEG'
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function fetchLogo(url: string): Promise<LogoResult | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const [dataUrl, format] = await Promise.all([blobToDataUrl(blob), detectFormat(blob)])
    return { dataUrl, format }
  } catch {
    return null
  }
}

async function loadLogo(logoUrl?: string | null): Promise<LogoResult | null> {
  if (logoUrl) {
    const custom = await fetchLogo(logoUrl)
    if (custom) return custom
  }
  return fetchLogo('/logo-marmoapp.jpg')
}

export async function gerarOrcamentoPDF(
  orc: OrcamentoPDF,
  marmoraria: Marmoraria,
  cliente: Cliente | null
): Promise<jsPDF> {
  const logoResult = await loadLogo(marmoraria.logo_url)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const GOLD = [201, 168, 76] as [number, number, number]
  const DARK = [26, 26, 26] as [number, number, number]
  const GRAY = [120, 120, 120] as [number, number, number]
  const WHITE = [255, 255, 255] as [number, number, number]

  let y = 0
  const HEADER_H = 48

  // ── Header background ─────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, HEADER_H, 'F')

  // Logo or company name — track where the logo ends to position subtitle
  let logoEndY = 24
  if (logoResult) {
    try {
      const props = doc.getImageProperties(logoResult.dataUrl)
      const ratio = props.width / props.height
      const maxW = 56
      const maxH = 28
      let dW = maxW
      let dH = dW / ratio
      if (dH > maxH) { dH = maxH; dW = dH * ratio }
      doc.addImage(logoResult.dataUrl, logoResult.format, 16, 6, dW, dH)
      logoEndY = 6 + dH
    } catch {
      doc.addImage(logoResult.dataUrl, logoResult.format, 16, 6, 28, 28)
      logoEndY = 34
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...WHITE)
    doc.text(marmoraria.nome, 16, 18)
  }

  // Subtitle positioned below logo
  const subY = logoEndY + 4
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 160, 100)
  const subParts: string[] = []
  if (marmoraria.cnpj) subParts.push(`CNPJ: ${marmoraria.cnpj}`)
  if (marmoraria.telefone) subParts.push(`Tel: ${marmoraria.telefone}`)
  const cidadeEstado = marmoraria.cidade && marmoraria.estado
    ? `${marmoraria.cidade} — ${marmoraria.estado}`
    : marmoraria.cidade || marmoraria.estado || ''
  if (cidadeEstado) subParts.push(cidadeEstado)
  if (subParts.length) doc.text(subParts.join('   ·   '), 16, subY)

  if (marmoraria.endereco) {
    doc.setTextColor(150, 140, 110)
    doc.text(marmoraria.endereco, 16, subY + 6)
  }

  // Orcamento number (right side)
  doc.setTextColor(...GOLD)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(orcNum(orc), W - 16, 18, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 160, 100)
  const emissao = new Date(orc.created_at).toLocaleDateString('pt-BR')
  doc.text(`Emissão: ${emissao}`, W - 16, 26, { align: 'right' })
  doc.text(`Validade: ${dataValidade(orc)}`, W - 16, 32, { align: 'right' })

  // Gold accent line
  doc.setFillColor(...GOLD)
  doc.rect(0, HEADER_H, W, 1.5, 'F')

  y = HEADER_H + 10

  // ── Client + Orcamento info ───────────────────────────────
  // Two columns
  const col1x = 16
  const col2x = W / 2 + 4

  // Column 1: Cliente
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('CLIENTE', col1x, y)

  y += 5
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(cliente?.nome || 'Cliente não informado', col1x, y)

  y += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  if (cliente?.telefone) { doc.text(`Tel: ${cliente.telefone}`, col1x, y); y += 4 }
  if (cliente?.email) { doc.text(`E-mail: ${cliente.email}`, col1x, y); y += 4 }
  if (cliente?.cpf_cnpj) { doc.text(`CPF/CNPJ: ${cliente.cpf_cnpj}`, col1x, y); y += 4 }

  // Column 2: Orcamento info
  const infoY = HEADER_H + 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('ORÇAMENTO', col2x, infoY)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
  }
  const rows2: [string, string][] = [
    ['Referência:', orcNum(orc)],
    ['Status:', statusLabels[orc.status] || orc.status],
    ['Emissão:', new Date(orc.created_at).toLocaleDateString('pt-BR')],
    ['Válido até:', dataValidade(orc)],
  ]
  rows2.forEach(([label, val], idx) => {
    const ry = infoY + 5 + idx * 5
    doc.setTextColor(...GRAY)
    doc.text(label, col2x, ry)
    doc.setTextColor(...DARK)
    doc.text(val, col2x + 30, ry)
  })

  // Separator line
  y = Math.max(y, infoY + 5 + rows2.length * 5) + 6
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(16, y, W - 16, y)
  y += 6

  // ── Description ──────────────────────────────────────────
  if (orc.descricao) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY)
    doc.text('DESCRIÇÃO', 16, y)
    y += 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(orc.descricao, W - 32)
    doc.text(lines, 16, y)
    y += lines.length * 5 + 4
  }

  // ── Items section ────────────────────────────────────────
  const hasVariants = !!(orc.tem_variantes && orc.itens.some(i => i.variante && i.variante !== 'base'))

  // Helper: render an items table, return finalY
  const drawItemsTable = (items: ItemPDF[], startY: number): number => {
    const ha = items.some(i => i.area || (i.largura && i.altura))
    const hd = ha
      ? [['Tipo', 'Descrição', 'Dimensões', 'Qtd', 'Preço/Un', 'Total']]
      : [['Tipo', 'Descrição', 'Qtd', 'Preço/Un', 'Total']]
    const bd = items.map(i => {
      const dim = i.area
        ? `${fmtNum(i.area)} m²`
        : i.largura && i.altura ? `${fmtNum(i.largura, 2)} × ${fmtNum(i.altura, 2)} m` : '—'
      const detalhe = pecaDetalhe(i)
      const descFull = detalhe ? `${i.descricao}\n${detalhe}` : i.descricao
      return ha
        ? [i.tipo, descFull, dim, fmtNum(i.quantidade), fmt(i.preco_unitario), fmt(i.total_item)]
        : [i.tipo, descFull, fmtNum(i.quantidade), fmt(i.preco_unitario), fmt(i.total_item)]
    })
    autoTable(doc, {
      startY, head: hd, body: bd, theme: 'grid',
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8, fontStyle: 'bold', cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } },
      bodyStyles: { fontSize: 8, textColor: DARK, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, overflow: 'linebreak' as const },
      alternateRowStyles: { fillColor: [248, 248, 248] as [number, number, number] },
      columnStyles: ha
        ? { 0: { cellWidth: 18 }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' } }
        : { 0: { cellWidth: 18 }, 2: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
      margin: { left: 16, right: 16 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (doc as any).lastAutoTable.finalY
  }

  // Helper: render a totals box, return new Y after box
  const drawTotalsBox = (lines: [string, string, boolean][], startY: number): number => {
    const boxW = 90
    const boxX = W - 16 - boxW
    const lineH = 7
    const boxH = lines.length * lineH + 8
    doc.setFillColor(245, 243, 238)
    doc.roundedRect(boxX, startY, boxW, boxH, 2, 2, 'F')
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.5)
    doc.roundedRect(boxX, startY, boxW, boxH, 2, 2, 'S')
    lines.forEach(([label, val, isFinal], idx) => {
      const ry = startY + 5 + idx * lineH
      if (isFinal) {
        doc.setFillColor(...GOLD)
        doc.rect(boxX, ry - 4, boxW, lineH + 1, 'F')
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
        doc.text(label, boxX + 5, ry + 1)
        doc.text(val, boxX + boxW - 5, ry + 1, { align: 'right' })
      } else {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY)
        doc.text(label, boxX + 5, ry)
        doc.setTextColor(...DARK)
        doc.text(val, boxX + boxW - 5, ry, { align: 'right' })
      }
    })
    return startY + boxH + 8
  }

  if (hasVariants) {
    const baseItems = orc.itens.filter(i => !i.variante || i.variante === 'base')
    const baseSubtotal = baseItems.reduce((s, i) => s + i.total_item, 0)

    // Base items section
    if (baseItems.length > 0) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY)
      doc.text('ITENS COMUNS (TODAS AS OPÇÕES)', 16, y)
      y += 3
      y = drawItemsTable(baseItems, y) + 6
    }

    // Per-variant sections
    const VCOLS: Record<string, [number, number, number]> = {
      A: [41, 128, 185], B: [39, 174, 96], C: [230, 126, 34],
    }
    const vNames: Record<string, string> = {
      A: orc.nome_variante_a || 'Opção A',
      B: orc.nome_variante_b || 'Opção B',
      C: orc.nome_variante_c || 'Opção C',
    }
    const vTotals: Record<string, number | undefined> = {
      A: orc.total_variante_a, B: orc.total_variante_b, C: orc.total_variante_c,
    }

    for (const vk of ['A', 'B', 'C']) {
      const vItems = orc.itens.filter(i => i.variante === vk)
      if (vItems.length === 0) continue
      const vName = vNames[vk]
      const vColor = VCOLS[vk]
      const vSubtotal = vItems.reduce((s, i) => s + i.total_item, 0)
      const vTotal = vTotals[vk] ?? (baseSubtotal + vSubtotal + orc.mao_obra - orc.desconto_rs)

      // Variant colored header bar
      doc.setFillColor(...vColor)
      doc.rect(16, y, W - 32, 7, 'F')
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
      doc.text(vName.toUpperCase(), 20, y + 4.8)
      y += 10

      y = drawItemsTable(vItems, y) + 6

      // Variant totals box
      const tLines: [string, string, boolean][] = []
      if (baseItems.length > 0) tLines.push(['Itens comuns', fmt(baseSubtotal), false])
      tLines.push([vName, fmt(vSubtotal), false])
      if (orc.mao_obra > 0) tLines.push(['Mão de obra', fmt(orc.mao_obra), false])
      if (orc.desconto_rs > 0) tLines.push(['Desconto', `– ${fmt(orc.desconto_rs)}`, false])
      tLines.push([`TOTAL ${vName.toUpperCase()}`, fmt(vTotal), true])
      y = drawTotalsBox(tLines, y)
    }
  } else {
    // Single items table + totals box
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY)
    doc.text('ITENS DO ORÇAMENTO', 16, y)
    y += 3
    y = drawItemsTable(orc.itens, y) + 6

    const subtotal = orc.itens.reduce((s, i) => s + i.total_item, 0)
    const totalLines: [string, string, boolean][] = [['Subtotal dos itens', fmt(subtotal), false]]
    if (orc.mao_obra > 0) totalLines.push(['Mão de obra', fmt(orc.mao_obra), false])
    if (orc.desconto_rs > 0) totalLines.push(['Desconto', `– ${fmt(orc.desconto_rs)}`, false])
    totalLines.push(['TOTAL GERAL', fmt(orc.total), true])
    y = drawTotalsBox(totalLines, y)
  }

  // ── Observações ──────────────────────────────────────────
  if (orc.observacoes) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY)
    doc.text('OBSERVAÇÕES', 16, y)
    y += 5
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const obsLines = doc.splitTextToSize(orc.observacoes, W - 32)
    doc.text(obsLines, 16, y)
    y += obsLines.length * 4.5 + 6
  }

  // ── Signature lines ───────────────────────────────────────
  const pageH = 297
  const sigY = Math.max(y + 10, pageH - 35)

  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(16, sigY, 90, sigY)
  doc.line(W / 2 + 4, sigY, W - 16, sigY)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Assinatura do cliente', 16, sigY + 4)
  doc.text('Responsável pela marmoraria', W / 2 + 4, sigY + 4)

  // ── Footer ────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, pageH - 12, W, 12, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 140, 110)
  doc.text(`${marmoraria.nome}  ·  Gerado por MarmoApp`, W / 2, pageH - 5, { align: 'center' })

  return doc
}

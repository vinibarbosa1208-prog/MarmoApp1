import { jsPDF } from 'jspdf'
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
  ambiente?: string
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

function fmtNum(n: number | undefined, decimals = 2): string {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const PECA_LABELS_PDF: Record<string, string> = {
  bancada_simples: 'Bancada de Pedra',
  bancada_cuba: 'Bancada com Cuba',
  bancada_saia: 'Bancada com Saia',
  bancada_frontao: 'Bancada com Frontão',
  ilha_cozinha: 'Ilha de Cozinha',
  escada: 'Escada em Pedra',
  soleira: 'Soleira / Peitoril',
  nicho: 'Nicho em Pedra',
  pia_l: 'Pia em L',
  pia_u: 'Pia em U',
  pia_retangular: 'Pia Retangular',
  lavatorio_simples: 'Lavatório Simples',
  lavatorio_extensao: 'Lavatório c/ Extensão',
}

const ACAB_LABELS_PDF: Record<string, string> = {
  reto: 'Reto (fio reto)',
  boleado: 'Boleado (arredondado)',
  meia_esquadria: 'Meia Esquadria (chanfrado)',
  frontao: 'Frontão (parte frontal elevada)',
  sem_acabamento: 'Sem acabamento',
}

const LATERAL_LABELS_PDF: Record<string, string> = {
  esquerda: 'Lado esquerdo',
  direita: 'Lado direito',
  frente: 'Frente',
  fundo: 'Fundo / Encosto',
  superior: 'Parte superior',
  inferior: 'Parte inferior',
}

const SEM_AMBIENTE_LABEL = 'Itens Gerais'

// Agrupa os itens pelo campo `ambiente` (definido na etapa "Ambientes" da
// criação do orçamento), preservando a ordem em que os ambientes aparecem
// nos itens. Itens sem ambiente definido caem num grupo à parte, no fim.
function agruparPorAmbiente(items: ItemPDF[]): { nome: string; items: ItemPDF[] }[] {
  const ordem: string[] = []
  const porAmbiente: Record<string, ItemPDF[]> = {}
  const semAmbiente: ItemPDF[] = []

  for (const item of items) {
    const amb = item.ambiente?.trim()
    if (!amb) { semAmbiente.push(item); continue }
    if (!porAmbiente[amb]) { porAmbiente[amb] = []; ordem.push(amb) }
    porAmbiente[amb].push(item)
  }

  const grupos = ordem.map(nome => ({ nome, items: porAmbiente[nome] }))
  if (semAmbiente.length > 0) grupos.push({ nome: SEM_AMBIENTE_LABEL, items: semAmbiente })
  return grupos
}

// Especificações do item para exibir no card — nunca inclui preço por m²
// ou qualquer valor unitário, só medidas e características físicas.
function especificacoesCard(i: ItemPDF): string {
  const parts: string[] = []

  if (i.tipo_peca) parts.push(PECA_LABELS_PDF[i.tipo_peca] || i.tipo_peca)

  const sides = ['esquerda', 'direita', 'frente', 'fundo', 'superior', 'inferior'] as const
  const acabMap: Record<string, string> = {}
  for (const lat of sides) {
    const v = (i as unknown as Record<string, unknown>)[`acabamento_${lat}`] as string | undefined
    if (v) acabMap[lat] = v
  }
  const activeSides = Object.keys(acabMap)
  if (activeSides.length > 0) {
    const uniqueAcabs = [...new Set(Object.values(acabMap))]
    if (uniqueAcabs.length === 1 && activeSides.length >= 3) {
      const lbl = ACAB_LABELS_PDF[uniqueAcabs[0]] || uniqueAcabs[0]
      parts.push(`Acabamento ${lbl}`)
    } else {
      for (const lat of activeSides) {
        const v = acabMap[lat]
        const finishLbl = ACAB_LABELS_PDF[v] || v
        const sideLbl = LATERAL_LABELS_PDF[lat] || lat
        const raio = i.dados_extras?.[`raio_${lat}`] as number | undefined
        parts.push(`${sideLbl}: ${finishLbl}${v === 'boleado' && raio ? ` (raio ${raio}mm)` : ''}`)
      }
    }
  }

  if (i.tem_saia && i.altura_saia) parts.push(`Saia lateral de ${i.altura_saia}cm`)
  if (i.tem_frontao && i.altura_frontao) parts.push(`Frontão de ${i.altura_frontao}cm`)

  const ex = i.dados_extras
  if (ex) {
    if (ex.tipo_cuba) parts.push(`Cuba: ${ex.tipo_cuba}`)
    if (ex.num_degraus) parts.push(`${ex.num_degraus} degraus`)
    if (ex.largura_piso) parts.push(`Largura do piso: ${ex.largura_piso}cm`)
    if (ex.altura_espelho) parts.push(`Altura do espelho: ${ex.altura_espelho}cm`)
    if (ex.comprimento) parts.push(`Medidas: ${ex.comprimento}×${ex.largura || '?'}cm`)
  }

  if (i.area) parts.push(`${fmtNum(i.area)} m²`)
  else if (i.largura && i.altura) parts.push(`${fmtNum(i.largura)} × ${fmtNum(i.altura)} m`)
  else if (i.quantidade && i.quantidade !== 1) parts.push(`${fmtNum(i.quantidade, 0)} unid.`)

  return parts.join('  ·  ')
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
  return fetchLogo('/logo-marmoapp-transparente.png')
}

export async function gerarOrcamentoPDF(
  orc: OrcamentoPDF,
  marmoraria: Marmoraria,
  cliente: Cliente | null
): Promise<jsPDF> {
  const logoResult = await loadLogo(marmoraria.logo_url)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const PAGE_H = 297
  const MARGIN = 16
  const CONTENT_W = W - MARGIN * 2
  const GOLD: [number, number, number] = [201, 168, 76]
  const DARK: [number, number, number] = [26, 26, 26]
  const GRAY: [number, number, number] = [120, 120, 120]
  const WHITE: [number, number, number] = [255, 255, 255]
  const CREAM: [number, number, number] = [248, 246, 241]
  const HEADER_H = 46

  // Garante espaço vertical, pulando de página quando necessário.
  // Páginas além da primeira não repetem o cabeçalho — só uma margem no topo.
  const ensureSpace = (currentY: number, needed: number): number => {
    if (currentY + needed > PAGE_H - 14) {
      doc.addPage()
      return 20
    }
    return currentY
  }

  // ── Header ─────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, HEADER_H, 'F')

  if (logoResult) {
    try {
      const props = doc.getImageProperties(logoResult.dataUrl)
      const ratio = props.width / props.height
      const maxW = 32
      const maxH = 26
      let dW = maxW
      let dH = dW / ratio
      if (dH > maxH) { dH = maxH; dW = dH * ratio }
      doc.addImage(logoResult.dataUrl, logoResult.format, MARGIN, 8, dW, dH)
    } catch {
      doc.addImage(logoResult.dataUrl, logoResult.format, MARGIN, 8, 26, 26)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...WHITE)
    doc.text(marmoraria.nome, MARGIN, 22)
  }

  const infoX = logoResult ? MARGIN + 36 : MARGIN
  const infoY = logoResult ? 16 : 30
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 160, 100)
  const subParts: string[] = []
  if (marmoraria.cnpj) subParts.push(`CNPJ ${marmoraria.cnpj}`)
  if (marmoraria.telefone) subParts.push(marmoraria.telefone)
  const cidadeEstado = marmoraria.cidade && marmoraria.estado
    ? `${marmoraria.cidade} — ${marmoraria.estado}`
    : marmoraria.cidade || marmoraria.estado || ''
  if (cidadeEstado) subParts.push(cidadeEstado)
  if (subParts.length) doc.text(subParts.join('   ·   '), infoX, infoY)
  if (marmoraria.endereco) doc.text(marmoraria.endereco, infoX, infoY + 5.5)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(180, 160, 100)
  doc.text('PROPOSTA DE ORÇAMENTO', W - MARGIN, 16, { align: 'right' })
  doc.setFontSize(19)
  doc.setTextColor(...GOLD)
  doc.text(orcNum(orc), W - MARGIN, 26, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 160, 100)
  const emissao = new Date(orc.created_at).toLocaleDateString('pt-BR')
  doc.text(`Emitido em ${emissao}  ·  Válido até ${dataValidade(orc)}`, W - MARGIN, 33, { align: 'right' })

  doc.setFillColor(...GOLD)
  doc.rect(0, HEADER_H, W, 1.5, 'F')

  let y = HEADER_H + 12

  // ── Cliente ────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('PREPARADO ESPECIALMENTE PARA', MARGIN, y)
  y += 7
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(cliente?.nome || 'Cliente não informado', MARGIN, y)
  y += 5.5

  const clienteParts: string[] = []
  if (cliente?.telefone) clienteParts.push(`Tel: ${cliente.telefone}`)
  if (cliente?.email) clienteParts.push(cliente.email)
  if (cliente?.cpf_cnpj) clienteParts.push(`CPF/CNPJ: ${cliente.cpf_cnpj}`)
  if (clienteParts.length) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(clienteParts.join('   ·   '), MARGIN, y)
    y += 5
  }
  y += 4

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 8

  // ── Descrição ──────────────────────────────────────────────
  if (orc.descricao) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    const lines = doc.splitTextToSize(orc.descricao, CONTENT_W)
    y = ensureSpace(y, lines.length * 5 + 4)
    doc.text(lines, MARGIN, y)
    y += lines.length * 5 + 6
  }

  // ── Card de um item (mede e desenha) ────────────────────────
  // Não exibe valor por item — só o que está incluso (descrição +
  // especificações). O único valor em R$ que aparece é o subtotal do
  // ambiente e o total geral, mais abaixo.
  const measureCard = (item: ItemPDF) => {
    const pad = 5.5
    const titleW = CONTENT_W - pad * 2
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    const titleLines = doc.splitTextToSize(item.descricao, titleW)
    const spec = especificacoesCard(item)
    doc.setFontSize(8.3)
    doc.setFont('helvetica', 'normal')
    const specLines: string[] = spec ? doc.splitTextToSize(spec, titleW) : []
    const titleLineH = 4.8
    const specLineH = 4
    const innerH = titleLines.length * titleLineH + (specLines.length ? specLines.length * specLineH + 1.5 : 0)
    const cardH = Math.max(13, innerH + pad * 1.7)
    return { pad, titleLines, specLines, titleLineH, specLineH, cardH }
  }

  const drawCard = (item: ItemPDF, startY: number): number => {
    const { pad, titleLines, specLines, titleLineH, cardH } = measureCard(item)

    doc.setFillColor(...CREAM)
    doc.roundedRect(MARGIN, startY, CONTENT_W, cardH, 2, 2, 'F')

    let ty = startY + pad + titleLineH * 0.72
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(titleLines, MARGIN + pad, ty)
    ty += titleLines.length * titleLineH

    if (specLines.length) {
      doc.setFontSize(8.3)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY)
      doc.text(specLines, MARGIN + pad, ty + 1.5)
    }

    return cardH
  }

  // Lista simples de cards, um embaixo do outro (usada dentro das
  // subseções Material/Serviço de cada ambiente)
  const drawItemList = (items: ItemPDF[], startY: number): number => {
    let cy = startY
    for (const item of items) {
      const { cardH } = measureCard(item)
      cy = ensureSpace(cy, cardH + 3.2)
      const drawnH = drawCard(item, cy)
      cy += drawnH + 3.2
    }
    return cy
  }

  // Um ambiente completo: título do ambiente, subseção Material, subseção
  // Serviço (acabamento + colocação juntos) e uma barra de subtotal do
  // ambiente ao final.
  const drawAmbienteGroup = (nome: string, items: ItemPDF[], startY: number, accent: [number, number, number] = GOLD): number => {
    let cy = ensureSpace(startY, 13)
    doc.setFontSize(11.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(nome, MARGIN, cy)
    doc.setDrawColor(...accent)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, cy + 2.6, W - MARGIN, cy + 2.6)
    cy += 8.5

    const materiais = items.filter(i => i.tipo === 'material')
    const servicos = items.filter(i => i.tipo !== 'material')

    if (materiais.length > 0) {
      cy = ensureSpace(cy, 8)
      doc.setFontSize(7.8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRAY)
      doc.text('MATERIAL', MARGIN, cy)
      cy += 5.5
      cy = drawItemList(materiais, cy) + 1
    }

    if (servicos.length > 0) {
      cy = ensureSpace(cy, 8)
      doc.setFontSize(7.8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRAY)
      doc.text('SERVIÇO', MARGIN, cy)
      cy += 5.5
      cy = drawItemList(servicos, cy) + 1
    }

    const totalAmbiente = items.reduce((s, i) => s + i.total_item, 0)
    cy = ensureSpace(cy, 12)
    doc.setFillColor(250, 245, 231)
    doc.rect(MARGIN, cy, CONTENT_W, 9.5, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(`TOTAL ${nome.toUpperCase()}`, MARGIN + 5, cy + 6.3)
    doc.text(fmt(totalAmbiente), MARGIN + CONTENT_W - 5, cy + 6.3, { align: 'right' })
    cy += 9.5 + 5

    return cy
  }

  // Roda todos os ambientes de uma lista de itens em sequência
  const drawAmbienteGroups = (items: ItemPDF[], startY: number, accent: [number, number, number] = GOLD): number => {
    let cy = startY
    for (const grupo of agruparPorAmbiente(items)) {
      cy = drawAmbienteGroup(grupo.nome, grupo.items, cy, accent)
    }
    return cy
  }

  // Caixa de totais em destaque (usada no orçamento sem variantes)
  const drawTotalsDark = (lines: [string, string][], finalLabel: string, finalVal: string, startY: number, accent: [number, number, number] = GOLD): number => {
    const boxH = lines.length * 6.1 + 18
    const sy = ensureSpace(startY, boxH + 6)
    doc.setFillColor(...DARK)
    doc.roundedRect(MARGIN, sy, CONTENT_W, boxH, 3, 3, 'F')

    let ly = sy + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(200, 200, 200)
    for (const [label, val] of lines) {
      doc.text(label, MARGIN + 8, ly)
      doc.text(val, MARGIN + CONTENT_W - 8, ly, { align: 'right' })
      ly += 6.1
    }

    doc.setDrawColor(...accent)
    doc.setLineWidth(0.3)
    doc.line(MARGIN + 8, ly - 2.3, MARGIN + CONTENT_W - 8, ly - 2.3)
    ly += 5

    doc.setFontSize(11.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...accent)
    doc.text(finalLabel.toUpperCase(), MARGIN + 8, ly)
    doc.setFontSize(15)
    doc.setTextColor(...WHITE)
    doc.text(finalVal, MARGIN + CONTENT_W - 8, ly + 0.5, { align: 'right' })

    return sy + boxH + 8
  }

  // Caixa de totais mais discreta (usada por variante, com a cor da variante)
  const drawTotalsLight = (lines: [string, string, boolean][], startY: number, accent: [number, number, number]): number => {
    const boxW = 92
    const boxX = W - MARGIN - boxW
    const lineH = 7
    const boxH = lines.length * lineH + 8
    const sy = ensureSpace(startY, boxH + 6)
    doc.setFillColor(...CREAM)
    doc.roundedRect(boxX, sy, boxW, boxH, 2, 2, 'F')
    doc.setDrawColor(...accent)
    doc.setLineWidth(0.5)
    doc.roundedRect(boxX, sy, boxW, boxH, 2, 2, 'S')
    lines.forEach(([label, val, isFinal], idx) => {
      const ry = sy + 5 + idx * lineH
      if (isFinal) {
        doc.setFillColor(...accent)
        doc.rect(boxX, ry - 4, boxW, lineH + 1, 'F')
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
      } else {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY)
      }
      doc.text(label, boxX + 5, ry + (isFinal ? 1 : 0))
      doc.setTextColor(...DARK)
      doc.text(val, boxX + boxW - 5, ry + (isFinal ? 1 : 0), { align: 'right' })
    })
    return sy + boxH + 8
  }

  // ── Itens ──────────────────────────────────────────────────
  const hasVariants = !!(orc.tem_variantes && orc.itens.some(i => i.variante && i.variante !== 'base'))

  if (hasVariants) {
    const baseItems = orc.itens.filter(i => !i.variante || i.variante === 'base')
    const baseSubtotal = baseItems.reduce((s, i) => s + i.total_item, 0)

    if (baseItems.length > 0) {
      y = ensureSpace(y, 10)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GOLD)
      doc.text('ITENS COMUNS (TODAS AS OPÇÕES)', MARGIN, y)
      y += 8
      y = drawAmbienteGroups(baseItems, y) + 2
    }

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

      y = ensureSpace(y, 14)
      doc.setFillColor(...vColor)
      doc.rect(MARGIN, y, CONTENT_W, 8, 'F')
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
      doc.text(vName.toUpperCase(), MARGIN + 4, y + 5.5)
      y += 12

      y = drawAmbienteGroups(vItems, y, vColor) + 2

      const tLines: [string, string, boolean][] = []
      if (baseItems.length > 0) tLines.push(['Itens comuns', fmt(baseSubtotal), false])
      tLines.push([vName, fmt(vSubtotal), false])
      if (orc.mao_obra > 0) tLines.push(['Mão de obra', fmt(orc.mao_obra), false])
      if (orc.desconto_rs > 0) tLines.push(['Desconto', `– ${fmt(orc.desconto_rs)}`, false])
      tLines.push([`TOTAL ${vName.toUpperCase()}`, fmt(vTotal), true])
      y = drawTotalsLight(tLines, y, vColor)
    }
  } else {
    y = drawAmbienteGroups(orc.itens, y)

    const subtotal = orc.itens.reduce((s, i) => s + i.total_item, 0)
    const lines: [string, string][] = [['Subtotal dos ambientes', fmt(subtotal)]]
    if (orc.mao_obra > 0) lines.push(['Mão de obra', fmt(orc.mao_obra)])
    if (orc.desconto_rs > 0) lines.push(['Desconto', `– ${fmt(orc.desconto_rs)}`])
    y = drawTotalsDark(lines, 'Total geral', fmt(orc.total), y)
  }

  // ── Observações ──────────────────────────────────────────
  if (orc.observacoes) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY)
    const obsLines = doc.splitTextToSize(orc.observacoes, CONTENT_W)
    y = ensureSpace(y, obsLines.length * 4.5 + 11)
    doc.text('OBSERVAÇÕES', MARGIN, y)
    y += 5
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    doc.text(obsLines, MARGIN, y)
    y += obsLines.length * 4.5 + 6
  }

  // ── Assinaturas ────────────────────────────────────────────
  y = ensureSpace(y, 30)
  const sigY = Math.max(y + 10, PAGE_H - 35)

  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, sigY, 90, sigY)
  doc.line(W / 2 + 4, sigY, W - MARGIN, sigY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Assinatura do cliente', MARGIN, sigY + 4)
  doc.text('Responsável pela marmoraria', W / 2 + 4, sigY + 4)

  // ── Rodapé (em todas as páginas) ────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFillColor(...DARK)
    doc.rect(0, PAGE_H - 12, W, 12, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 140, 110)
    doc.text(`${marmoraria.nome}  ·  Gerado por MarmoApp`, W / 2, PAGE_H - 5, { align: 'center' })
  }

  return doc
}

import { jsPDF } from 'jspdf'
import type { Marmoraria } from '@/lib/types'

// Checklist semanal de compras — junta tudo que a equipe da produção pediu
// durante a semana (digitado a partir da lista de papel/quadro do chão de
// fábrica) num único PDF pra levar até a loja e ir marcando o que já foi
// comprado. Não é um pedido de compra formal (sem fornecedor/preço) — é só
// a lista de conferência.

export interface ItemListaInsumos {
  id: string
  nome: string
  quantidade: number | null
  unidade: string | null
  solicitado_por: string
  observacao: string | null
}

export function gerarListaInsumosPDF(
  itens: ItemListaInsumos[],
  marmoraria: Pick<Marmoraria, 'nome'>
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const PAGE_H = 297
  const MARGIN = 16
  const CONTENT_W = W - MARGIN * 2
  const GOLD: [number, number, number] = [201, 168, 76]
  const DARK: [number, number, number] = [26, 26, 26]
  const GRAY: [number, number, number] = [120, 120, 120]
  const WHITE: [number, number, number] = [255, 255, 255]
  const LIGHT: [number, number, number] = [245, 244, 240]
  const STRIPE: [number, number, number] = [250, 249, 246]

  const COL_CHECK = 12
  const COL_QTD = 30
  const COL_POR = 46
  const X_CHECK = MARGIN
  const X_ITEM = X_CHECK + COL_CHECK
  const X_QTD = W - MARGIN - COL_POR - COL_QTD
  const X_POR = W - MARGIN - COL_POR
  const COL_ITEM = X_QTD - X_ITEM
  const ROW_MIN_H = 12
  const HEADER_H = 30
  const TOP_Y = HEADER_H + 10

  let paginaAtual = 1

  function desenharCabecalhoPagina() {
    doc.setFillColor(...DARK)
    doc.rect(0, 0, W, HEADER_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...WHITE)
    doc.text(marmoraria.nome || 'MarmoApp', MARGIN, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 160, 100)
    doc.text('LISTA DE COMPRAS DA SEMANA', MARGIN, 25)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 160, 100)
    doc.text(paginaAtual > 1 ? `Página ${paginaAtual}` : new Date().toLocaleDateString('pt-BR'), W - MARGIN, 18, { align: 'right' })

    doc.setFillColor(...GOLD)
    doc.rect(0, HEADER_H, W, 1.2, 'F')
  }

  function desenharCabecalhoTabela(yPos: number): number {
    doc.setFillColor(...DARK)
    doc.rect(MARGIN, yPos, CONTENT_W, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...WHITE)
    doc.text('OK', X_CHECK + 2, yPos + 5.5)
    doc.text('ITEM', X_ITEM + 2, yPos + 5.5)
    doc.text('QTD', X_QTD + 2, yPos + 5.5)
    doc.text('PEDIDO POR', X_POR + 2, yPos + 5.5)
    return yPos + 8
  }

  function novaPagina(): number {
    doc.addPage()
    paginaAtual++
    desenharCabecalhoPagina()
    return desenharCabecalhoTabela(TOP_Y)
  }

  desenharCabecalhoPagina()
  let y = TOP_Y

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Gerada em ${new Date().toLocaleDateString('pt-BR')}  ·  ${itens.length} ite${itens.length === 1 ? 'm' : 'ns'} pendente${itens.length === 1 ? '' : 's'}`, MARGIN, y)
  y += 9

  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.2)
  y = desenharCabecalhoTabela(y)

  itens.forEach((item, idx) => {
    const temObs = !!item.observacao
    const rowH = temObs ? ROW_MIN_H + 4 : ROW_MIN_H

    if (y + rowH > PAGE_H - 20) y = novaPagina()

    if (idx % 2 === 1) {
      doc.setFillColor(...STRIPE)
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
    }
    doc.setDrawColor(210, 210, 210)
    doc.rect(MARGIN, y, CONTENT_W, rowH)
    doc.line(X_ITEM, y, X_ITEM, y + rowH)
    doc.line(X_QTD, y, X_QTD, y + rowH)
    doc.line(X_POR, y, X_POR, y + rowH)

    // Checkbox
    doc.setDrawColor(...DARK)
    doc.rect(X_CHECK + (COL_CHECK - 5.5) / 2, y + 4, 5.5, 5.5)

    // Item (+ observação numa segunda linha, se houver)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...DARK)
    const linhasNome = doc.splitTextToSize(item.nome, COL_ITEM - 4)
    doc.text(linhasNome.slice(0, 1), X_ITEM + 2, y + (temObs ? 6 : rowH / 2 + 1.5))
    if (temObs) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      const linhasObs = doc.splitTextToSize(item.observacao || '', COL_ITEM - 4)
      doc.text(linhasObs.slice(0, 1), X_ITEM + 2, y + 11.5)
    }

    // Qtd
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    const qtdTexto = item.quantidade ? `${item.quantidade}${item.unidade ? ' ' + item.unidade : ''}` : '—'
    doc.text(qtdTexto, X_QTD + 2, y + rowH / 2 + 1.5)

    // Solicitado por
    doc.setTextColor(...DARK)
    const linhasPor = doc.splitTextToSize(item.solicitado_por, COL_POR - 4)
    doc.text(linhasPor.slice(0, 1), X_POR + 2, y + rowH / 2 + 1.5)

    y += rowH
  })

  if (itens.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('Nenhuma solicitação pendente.', MARGIN, y + 6)
  }

  return doc
}

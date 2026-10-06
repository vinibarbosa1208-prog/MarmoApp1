import { jsPDF } from 'jspdf'
import type { Marmoraria } from '@/lib/types'
import { DIAS_SEMANA, diasDaSemana, ddmm, rotuloPeriodo } from '@/lib/producao/semana'

// Ficha semanal de produção — uma folha A4 por pessoa, seg a sáb, com os
// blocos de cada dia já impressos. Começou a ser usada em 07/10/2026, antes
// da tela de lançamento existir: o colaborador anota a lápis e o gestor
// digita depois, com a data do bloco (nunca a data da digitação).
//
// Mesmo padrão de `gerar-formulario-producao-pdf.ts`: jsPDF, helvetica,
// "m2" sem expoente (o 2 sobrescrito some silenciosamente nas fontes
// padrão do jsPDF).
//
// NADA de preço, valor ou margem sai impresso aqui — é papel de chão de
// fábrica, circula na mão de todo mundo.

export type ModeloFicha = 'corte' | 'acabamento'

export interface LinhaFichaImpressa {
  /** 'YYYY-MM-DD' — o bloco do dia onde a linha entra */
  data: string
  cliente: string
  peca: string
  /** ml (acabamento/instalação) ou m² (corte) já lançado */
  quantidade: number
  /** 'R' | 'ME' | 'INST' no modelo de acabamento */
  tipo?: string
  /** modelo de corte: comprimento × largura em metros */
  comprimento?: number | null
  largura?: number | null
}

export interface PessoaFicha {
  nome: string
  modelo: ModeloFicha
  /**
   * Linhas já digitadas, pra "Imprimir ficha preenchida" (arquivo de
   * conferência do histórico). Em branco gera a ficha vazia pra imprimir e
   * levar pra fábrica.
   */
  linhas?: LinhaFichaImpressa[]
}

const W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = W - MARGIN * 2

const GOLD: [number, number, number] = [201, 168, 76]
const DARK: [number, number, number] = [26, 26, 26]
const GRAY: [number, number, number] = [120, 120, 120]
const WHITE: [number, number, number] = [255, 255, 255]
const DIA_BG: [number, number, number] = [245, 244, 240]
const EXTRA_BG: [number, number, number] = [250, 243, 224]

const HEADER_H = 26
const BARRA_H = 5.8
const ROW_H = 7
const LINHAS_POR_DIA = 4
const LINHAS_EXTRAS = 4

const RODAPE_ACABAMENTO = [
  'Como medir: passe a trena ao longo da borda que você acabou ou instalou e anote o comprimento.',
  'Se fez mais de uma borda na mesma peça, some tudo.',
  'R = reto  ·  ME = meia esquadria  ·  INST = instalação',
]
const RODAPE_CORTE = [
  'Anote comprimento × largura da peça cortada, em metros.',
  'Uma linha por peça. Se cortou a mesma peça mais de uma vez, use uma linha para cada.',
]

interface Coluna {
  titulo: string
  x: number
  largura: number
}

// Colunas por modelo. O bloco de linhas extras ganha uma coluna "Dia" no
// começo (a pessoa anota a que dia a linha pertence), tirando a largura da
// coluna Cliente — as outras ficam no mesmo lugar nos dois blocos pra a
// folha não parecer duas tabelas diferentes.
function colunas(modelo: ModeloFicha, comDia: boolean): Coluna[] {
  const cols: Coluna[] = []
  let x = MARGIN
  const push = (titulo: string, largura: number) => { cols.push({ titulo, x, largura }); x += largura }

  const larguraDia = comDia ? 16 : 0
  if (comDia) push('DIA', larguraDia)

  if (modelo === 'corte') {
    push('CLIENTE', 58 - larguraDia)
    push('PEÇA', 72)
    push('MEDIDAS (C × L) em metros', CONTENT_W - (58 - larguraDia) - 72 - larguraDia)
  } else {
    push('CLIENTE', 54 - larguraDia)
    push('PEÇA', 58)
    push('METROS LINEARES', 36)
    push('TIPO (R / ME / INST)', CONTENT_W - (54 - larguraDia) - 58 - 36 - larguraDia)
  }
  return cols
}

function fmtMedida(n: number | null | undefined): string {
  if (!n) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function gerarFichaSemanalPDF(
  pessoas: PessoaFicha[],
  semanaInicio: string,
  marmoraria: Pick<Marmoraria, 'nome'>
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dias = diasDaSemana(semanaInicio)
  const periodo = rotuloPeriodo(semanaInicio)

  pessoas.forEach((pessoa, idx) => {
    if (idx > 0) doc.addPage()
    desenharPagina(doc, pessoa, dias, periodo, marmoraria)
  })

  // Sem ninguém pra imprimir, devolve uma folha explicando — melhor que um
  // PDF de zero páginas, que o viewer do navegador nem abre.
  if (pessoas.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...GRAY)
    doc.text('Nenhum funcionário ativo com cargo serrador, acabador ou instalador.', MARGIN, 40)
  }

  return doc
}

function desenharPagina(
  doc: jsPDF,
  pessoa: PessoaFicha,
  dias: string[],
  periodo: string,
  marmoraria: Pick<Marmoraria, 'nome'>
) {
  // ── Cabeçalho ──────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, HEADER_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text(marmoraria.nome || 'MarmoApp', MARGIN, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 160, 100)
  doc.text('FICHA SEMANAL DE PRODUÇÃO', MARGIN, 17.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(180, 160, 100)
  doc.text(pessoa.modelo === 'corte' ? 'MODELO: CORTE' : 'MODELO: ACABAMENTO / INSTALAÇÃO', MARGIN, 22.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...GOLD)
  doc.text(pessoa.nome, W - MARGIN, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 160, 100)
  doc.text(periodo, W - MARGIN, 19, { align: 'right' })

  doc.setFillColor(...GOLD)
  doc.rect(0, HEADER_H, W, 1.2, 'F')

  let y = HEADER_H + 7

  // ── Blocos dos dias ────────────────────────────────────────────
  const cols = colunas(pessoa.modelo, false)
  const linhasPorDia = new Map<string, LinhaFichaImpressa[]>()
  for (const l of pessoa.linhas ?? []) {
    const lista = linhasPorDia.get(l.data) ?? []
    lista.push(l)
    linhasPorDia.set(l.data, lista)
  }

  dias.forEach((dia, i) => {
    const preenchidas = linhasPorDia.get(dia) ?? []
    // Sempre as 4 linhas impressas; se o dia digitado tiver mais, cresce o
    // bloco pra caber tudo (só acontece na ficha preenchida do histórico).
    const nLinhas = Math.max(LINHAS_POR_DIA, preenchidas.length)
    y = desenharBloco(doc, y, `${DIAS_SEMANA[i].toUpperCase()}  —  ${ddmm(dia)}`, cols, nLinhas, preenchidas, pessoa.modelo, DIA_BG)
  })

  // ── Linhas extras (com coluna Dia) ─────────────────────────────
  const colsExtra = colunas(pessoa.modelo, true)
  y = desenharBloco(doc, y + 1.5, 'LINHAS EXTRAS  —  ANOTE O DIA', colsExtra, LINHAS_EXTRAS, [], pessoa.modelo, EXTRA_BG)

  // ── Rodapé: como medir ─────────────────────────────────────────
  const rodape = pessoa.modelo === 'corte' ? RODAPE_CORTE : RODAPE_ACABAMENTO
  const alturaRodape = 5 + rodape.length * 4
  let yRodape = y + 4
  if (yRodape + alturaRodape > PAGE_H - 6) yRodape = PAGE_H - 6 - alturaRodape

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, yRodape, MARGIN + CONTENT_W, yRodape)
  yRodape += 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(rodape[0], MARGIN, yRodape)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  for (const linha of rodape.slice(1)) {
    yRodape += 4
    doc.text(linha, MARGIN, yRodape)
  }
}

function desenharBloco(
  doc: jsPDF,
  y: number,
  titulo: string,
  cols: Coluna[],
  nLinhas: number,
  preenchidas: LinhaFichaImpressa[],
  modelo: ModeloFicha,
  corBarra: [number, number, number]
): number {
  // Barra do dia
  doc.setFillColor(...corBarra)
  doc.rect(MARGIN, y, CONTENT_W, BARRA_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text(titulo, MARGIN + 2, y + BARRA_H - 1.7)

  // Títulos das colunas na própria barra, à direita do nome do dia — não
  // gasta uma faixa inteira por bloco (seriam 7 numa folha só).
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.6)
  doc.setTextColor(...GRAY)
  for (const c of cols) {
    if (c.x < MARGIN + 50) continue // não escreve por cima do nome do dia
    doc.text(c.titulo, c.x + 1.5, y + BARRA_H - 1.7)
  }
  y += BARRA_H

  // Linhas
  doc.setLineWidth(0.2)
  for (let i = 0; i < nLinhas; i++) {
    doc.setDrawColor(200, 200, 200)
    doc.rect(MARGIN, y, CONTENT_W, ROW_H)
    for (const c of cols.slice(1)) doc.line(c.x, y, c.x, y + ROW_H)

    const linha = preenchidas[i]
    if (linha) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      const valores = modelo === 'corte'
        ? [linha.cliente, linha.peca, linha.comprimento && linha.largura
            ? `${fmtMedida(linha.comprimento)} × ${fmtMedida(linha.largura)}`
            : `${fmtMedida(linha.quantidade)} m2`]
        : [linha.cliente, linha.peca, fmtMedida(linha.quantidade), linha.tipo ?? '']
      // Com a coluna Dia na frente (bloco de extras), desloca os valores.
      const offset = cols.length - valores.length
      valores.forEach((v, j) => {
        const c = cols[j + offset]
        if (!c) return
        const texto: string[] = doc.splitTextToSize(String(v ?? ''), c.largura - 3)
        doc.text(texto[0] ?? '', c.x + 1.5, y + ROW_H / 2 + 1.2)
      })
    }
    y += ROW_H
  }

  return y
}

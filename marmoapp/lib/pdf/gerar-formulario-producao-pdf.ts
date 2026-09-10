import { jsPDF } from 'jspdf'
import type { Marmoraria, Cliente, OrcamentoItem } from '@/lib/types'
import { mlAcabamentoItens } from '@/lib/utils'

// Formulário impresso de produção — pensado pra chão de fábrica que não usa
// celular/app em nenhuma etapa. Fica junto do desenho técnico do pedido; o
// serrador/acabador marca X na peça que terminou, com data e nome, e o
// gestor copia essas marcações pro modal "Registrar Corte/Acabamento" da
// Fila de Serviços (que já existe) uma vez por dia.
//
// Um formulário POR ETAPA (Corte / Colagem e Acabamento) — não um só com
// as duas etapas juntas — pra cada equipe imprimir só o que é dela, agrupado
// por ambiente do orçamento, com o total de m²/ml no rodapé pra servir de
// referência rápida de capacidade produtiva diária.
//
// Reaproveita as mesmas colunas usadas no schema por
// `orcamento_itens.cortado_em`/`acabado_em` — nada de estado novo, só a
// versão em papel do que o sistema já sabe registrar. "Colagem e Acabamento"
// aqui é só o nome do formulário: por baixo continua sendo a mesma etapa
// `acabamento`/`acabado_em` de sempre — não criei um estágio novo no
// pipeline pra não duplicar o que a Fila de Serviços já controla.

export type EtapaFormulario = 'corte' | 'acabamento'

export interface FormularioProducaoPDF {
  numero?: number
  descricao?: string
  created_at?: string
  data_prevista_instalacao?: string | null
  itens: OrcamentoItem[]
  // nome de cada funcionário por id (cortado_por/acabado_por) — pra mostrar
  // quem já fez, não só a data, na linha "já registrado". Opcional: sem o
  // mapa, mostra só a data.
  nomesFuncionarios?: Record<string, string>
  // Nome já impresso na coluna Responsável das peças ainda pendentes desta
  // etapa — só quando existe um único funcionário ativo pro cargo daquela
  // etapa (ex: um serrador só pra Corte). Com mais de um (ex: vários
  // acabadores), o campo fica em branco pra preencher na hora, porque não
  // dá pra saber de antemão quem vai fazer. Quem decide isso é quem chama
  // (a Fila de Serviços, que já sabe a lista de serradores/acabadores) —
  // o gerador só imprime o que vier aqui.
  responsavelPadrao?: string
}

const SEM_AMBIENTE_LABEL = 'Itens Gerais'

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function precisaCorte(i: OrcamentoItem): boolean {
  return (i.area || 0) > 0
}

// Mesmo critério de `itensRelevantesAcabamento` na Fila de Serviços — usa
// mlAcabamentoItens (precisa de largura/altura + lado com acabamento
// marcado), não só "tem algum campo de acabamento preenchido". Peças como
// pia em L/U guardam a geometria de outro jeito (sem largura/altura simples)
// e hoje o sistema não calcula ml de acabamento pra elas — por isso também
// não entram na checklist digital de Acabamento na Fila. Se o formulário
// impresso usasse um critério diferente daquele, o gestor marcaria no papel
// uma peça que nunca aparece pra confirmar no sistema.
function precisaAcabamento(i: OrcamentoItem): boolean {
  return mlAcabamentoItens([i]) > 0
}

function medidaItem(i: OrcamentoItem): string {
  // "m²" (com o 2 sobrescrito) some silenciosamente nas fontes padrão do
  // jsPDF (confirmado gerando e abrindo o PDF de teste) — usa "m2" mesmo,
  // igual outros textos técnicos do formulário.
  if (i.area) return `${fmtNum(i.area * (i.quantidade || 1))} m2`
  if (i.largura && i.altura) return `${fmtNum(i.largura)} × ${fmtNum(i.altura)} m`
  return '—'
}

function orcNum(numero?: number, dataRef?: string): string {
  const year = dataRef ? new Date(dataRef).getFullYear() : new Date().getFullYear()
  const num = String(numero ?? 0).padStart(4, '0')
  return `ORC-${year}-${num}`
}

// Agrupa por `ambiente` (mesmo campo/ordem de aparição usado no PDF de
// orçamento em `gerar-orcamento-pdf.ts`) — itens sem ambiente caem num
// grupo à parte, no fim.
function agruparPorAmbiente(itens: OrcamentoItem[]): { nome: string; itens: OrcamentoItem[] }[] {
  const ordem: string[] = []
  const porAmbiente: Record<string, OrcamentoItem[]> = {}
  const semAmbiente: OrcamentoItem[] = []

  for (const item of itens) {
    const amb = item.ambiente?.trim()
    if (!amb) { semAmbiente.push(item); continue }
    if (!porAmbiente[amb]) { porAmbiente[amb] = []; ordem.push(amb) }
    porAmbiente[amb].push(item)
  }

  const grupos = ordem.map(nome => ({ nome, itens: porAmbiente[nome] }))
  if (semAmbiente.length > 0) grupos.push({ nome: SEM_AMBIENTE_LABEL, itens: semAmbiente })
  return grupos
}

export function gerarFormularioProducaoPDF(
  orc: FormularioProducaoPDF,
  etapa: EtapaFormulario,
  marmoraria: Pick<Marmoraria, 'nome'>,
  cliente: Pick<Cliente, 'nome' | 'endereco' | 'cidade' | 'estado'> | null
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
  const AMBIENTE_BG: [number, number, number] = [250, 243, 224]

  const TITULO_ETAPA = etapa === 'corte' ? 'FORMULÁRIO DE CORTE' : 'FORMULÁRIO DE COLAGEM E ACABAMENTO'
  const LABEL_CONFIRMACAO = etapa === 'corte'
    ? 'PEÇAS 100% CORTADAS — pode seguir para colagem/acabamento'
    : 'PEDIDO 100% COLADO E ACABADO — pode agendar a instalação'

  // Colunas — só uma etapa por formulário, sobra espaço pra separar
  // checkbox / data / responsável em vez de empilhar tudo numa célula só.
  const COL_PECA = 62
  const COL_MEDIDA = 20
  const COL_CHECK = 14
  const COL_DATA = 38
  // Responsável ocupa o resto (62+20+14+38=134 de 178mm).
  const X_PECA = MARGIN
  const X_MEDIDA = X_PECA + COL_PECA
  const X_CHECK = X_MEDIDA + COL_MEDIDA
  const X_DATA = X_CHECK + COL_CHECK
  const X_POR = X_DATA + COL_DATA
  const ROW_H = 14
  const AMB_H = 7.5
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
    doc.text(TITULO_ETAPA, MARGIN, 25)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...GOLD)
    doc.text(orcNum(orc.numero, orc.created_at), W - MARGIN, 18, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 160, 100)
    doc.text(paginaAtual > 1 ? `Página ${paginaAtual}` : new Date().toLocaleDateString('pt-BR'), W - MARGIN, 25, { align: 'right' })

    doc.setFillColor(...GOLD)
    doc.rect(0, HEADER_H, W, 1.2, 'F')
  }

  function desenharCabecalhoTabela(yPos: number): number {
    doc.setFillColor(...DARK)
    doc.rect(MARGIN, yPos, CONTENT_W, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...WHITE)
    doc.text('PEÇA', X_PECA + 2, yPos + 5.5)
    doc.text('MEDIDA', X_MEDIDA + 2, yPos + 5.5)
    doc.text('OK', X_CHECK + 2, yPos + 5.5)
    doc.text('DATA', X_DATA + 2, yPos + 5.5)
    doc.text('RESPONSÁVEL', X_POR + 2, yPos + 5.5)
    return yPos + 8
  }

  function desenharCabecalhoAmbiente(yPos: number, nome: string): number {
    doc.setFillColor(...AMBIENTE_BG)
    doc.rect(MARGIN, yPos, CONTENT_W, AMB_H, 'F')
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, yPos + AMB_H, MARGIN + CONTENT_W, yPos + AMB_H)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...DARK)
    doc.text(`AMBIENTE — ${nome.toUpperCase()}`, X_PECA + 2, yPos + 5.2)
    return yPos + AMB_H
  }

  // Página nova "crua" (só o cabeçalho de marca) — quem chama decide se
  // redesenha o cabeçalho de colunas/ambiente em cima ou não.
  function novaPagina(): number {
    doc.addPage()
    paginaAtual++
    desenharCabecalhoPagina()
    return TOP_Y
  }

  desenharCabecalhoPagina()
  let y = TOP_Y

  // ── Dados do pedido ──────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text(orc.descricao || 'Pedido sem título', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  const clienteLinha = [cliente?.nome, cliente?.endereco, [cliente?.cidade, cliente?.estado].filter(Boolean).join(' - ')]
    .filter(Boolean).join('   ·   ')
  if (clienteLinha) { doc.text(clienteLinha, MARGIN, y); y += 5.5 }

  let infoLinha = `Formulário gerado em ${new Date().toLocaleDateString('pt-BR')}`
  if (orc.data_prevista_instalacao) {
    infoLinha += `   ·   Instalação prevista: ${new Date(orc.data_prevista_instalacao + 'T00:00:00').toLocaleDateString('pt-BR')}`
  }
  doc.text(infoLinha, MARGIN, y)
  y += 9

  // ── Instrução ────────────────────────────────────────────────
  doc.setFillColor(...LIGHT)
  doc.rect(MARGIN, y, CONTENT_W, 13, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.text('Marque X e preencha quem fez e a data assim que cada peça for concluída.', MARGIN + 3, y + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Manter este formulário junto com o desenho técnico do pedido até a instalação.', MARGIN + 3, y + 10)
  y += 19

  // ── Itens desta etapa, agrupados por ambiente ───────────────────
  const itensEtapa = orc.itens.filter(i => etapa === 'corte' ? precisaCorte(i) : precisaAcabamento(i))
  const grupos = agruparPorAmbiente(itensEtapa)
  const mostrarCabecalhoAmbiente = !(grupos.length === 1 && grupos[0].nome === SEM_AMBIENTE_LABEL)

  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.2)

  let linhaIdx = 0
  let tabelaAberta = false

  grupos.forEach(grupo => {
    // Cabeçalho de ambiente — garante espaço pro cabeçalho + pelo menos 1 linha
    if (mostrarCabecalhoAmbiente) {
      if (y + AMB_H + ROW_H > PAGE_H - 20) y = novaPagina()
      y = desenharCabecalhoAmbiente(y, grupo.nome)
      tabelaAberta = false
    }

    grupo.itens.forEach(item => {
      if (y + ROW_H > PAGE_H - 20) {
        y = novaPagina()
        tabelaAberta = false
        // Ambiente atravessou a quebra de página — repete o cabeçalho do
        // ambiente na página nova, senão quem lê perde de vista qual
        // ambiente essas peças são (com "(cont.)" pra deixar claro que é
        // a continuação, não um ambiente novo).
        if (mostrarCabecalhoAmbiente) y = desenharCabecalhoAmbiente(y, `${grupo.nome} (cont.)`)
      }
      if (!tabelaAberta) {
        y = desenharCabecalhoTabela(y)
        tabelaAberta = true
      }

      if (linhaIdx % 2 === 1) {
        doc.setFillColor(...STRIPE)
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F')
      }
      doc.setDrawColor(210, 210, 210)
      doc.rect(MARGIN, y, CONTENT_W, ROW_H)
      doc.line(X_MEDIDA, y, X_MEDIDA, y + ROW_H)
      doc.line(X_CHECK, y, X_CHECK, y + ROW_H)
      doc.line(X_DATA, y, X_DATA, y + ROW_H)
      doc.line(X_POR, y, X_POR, y + ROW_H)

      // Peça
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...DARK)
      const linhasDesc: string[] = doc.splitTextToSize(item.descricao || 'Peça', COL_PECA - 4)
      doc.text(linhasDesc.slice(0, 2), X_PECA + 2, y + ROW_H / 2 - 1)

      // Medida
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      doc.text(medidaItem(item), X_MEDIDA + 2, y + ROW_H / 2 + 1.5)

      // Status (checkbox / data / responsável)
      const dataFeito = etapa === 'corte' ? item.cortado_em : item.acabado_em
      const porFeito = etapa === 'corte' ? item.cortado_por : item.acabado_por
      const jaFeito = !!dataFeito

      doc.setDrawColor(...DARK)
      doc.rect(X_CHECK + (COL_CHECK - 5) / 2, y + (ROW_H - 5) / 2, 5, 5)
      if (jaFeito) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...DARK)
        doc.text('X', X_CHECK + COL_CHECK / 2 - 1.6, y + ROW_H / 2 + 2)
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(jaFeito ? DARK[0] : GRAY[0], jaFeito ? DARK[1] : GRAY[1], jaFeito ? DARK[2] : GRAY[2])
      if (jaFeito) {
        doc.text(new Date(dataFeito!).toLocaleDateString('pt-BR'), X_DATA + 3, y + ROW_H / 2 + 1.5)
      } else {
        doc.setTextColor(...GRAY)
        doc.text('____ /____ /____', X_DATA + 3, y + ROW_H / 2 + 1.5)
      }

      if (jaFeito) {
        const nome = porFeito ? orc.nomesFuncionarios?.[porFeito] : undefined
        doc.setTextColor(...DARK)
        doc.text(nome || '(já registrado)', X_POR + 3, y + ROW_H / 2 + 1.5)
      } else if (orc.responsavelPadrao) {
        // Só um funcionário ativo faz essa etapa (ex: um serrador só) —
        // já vem com o nome impresso, sobra só marcar a data quando
        // terminar. Com mais de um, `responsavelPadrao` vem undefined e
        // cai no branco de baixo, pra escrever a mão quem fez.
        doc.setTextColor(...GRAY)
        doc.text(orc.responsavelPadrao, X_POR + 3, y + ROW_H / 2 + 1.5)
      } else {
        doc.setTextColor(...GRAY)
        doc.text('_______________________', X_POR + 3, y + ROW_H / 2 + 1.5)
      }

      y += ROW_H
      linhaIdx++
    })
  })

  if (itensEtapa.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('Nenhuma peça deste pedido precisa desta etapa.', MARGIN, y + 6)
    y += 14
  }

  // ── Total do formulário (referência de capacidade produtiva diária) ──
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  const totalTexto = etapa === 'corte'
    ? `Total deste formulário: ${fmtNum(itensEtapa.reduce((s, i) => s + (i.area || 0) * (i.quantidade || 1), 0))} m2 de corte`
    : `Total deste formulário: ${fmtNum(itensEtapa.reduce((s, i) => s + mlAcabamentoItens([i]), 0))} ml de colagem/acabamento`
  doc.text(totalTexto, MARGIN, y)
  y += 8

  // ── Confirmação final ────────────────────────────────────────
  if (y + 26 > PAGE_H - 20) y = novaPagina()
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.5)
  doc.rect(MARGIN, y, CONTENT_W, 21)
  doc.rect(MARGIN + 5, y + 7, 5.5, 5.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...DARK)
  doc.text(LABEL_CONFIRMACAO, MARGIN + 15, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Data: ____ /____ /____          Conferido por: ________________________________', MARGIN + 15, y + 17)

  return doc
}

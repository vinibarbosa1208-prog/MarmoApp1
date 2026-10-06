import type { EtapaProducao, Pessoa } from './producao/pessoas'
import { isoLocal } from './producao/semana'

// === Capacidade produtiva medida ===
//
// Responde a pergunta do gestor: "se eu fechar um pedido hoje, em quantos
// dias úteis ele é entregue?". Tudo sai dos apontamentos que a ficha semanal
// gera, cruzados com a presença (que já existe desde 18/05/2026 e traz a
// diária do dia — a base do custo por ml).
//
// Funções puras, mesmo padrão de lib/dashboard.ts: quem chama busca os dados
// e passa; aqui só tem conta. Janela padrão: últimas 4 semanas.
//
// Base de apontamentos: `status <> 'rejeitado'`. Rejeitado é produção que o
// gestor não reconheceu — não entra em capacidade nem em custo.

export const JANELA_SEMANAS = 4
export const MIN_DIAS_CONFIAVEL = 10

export const ETAPAS: EtapaProducao[] = ['corte', 'acabamento', 'instalacao']

export const UNIDADE_ETAPA: Record<EtapaProducao, string> = {
  corte: 'm2',
  acabamento: 'ml eq.',
  instalacao: 'ml',
}

export const LABEL_ETAPA: Record<EtapaProducao, string> = {
  corte: 'Corte',
  acabamento: 'Acabamento',
  instalacao: 'Instalação',
}

export interface ApontamentoCapacidade {
  etapa: EtapaProducao
  data: string // 'YYYY-MM-DD'
  quantidade: number
  tipo_acabamento?: 'reto' | 'meia_esquadria' | null
  funcionario_id: string | null
  status?: string
  valor_calculado?: number | null
}

export interface PresencaCapacidade {
  funcionario_id: string
  data: string
  presente: boolean
  valor_diaria?: number | null
}

/** Peça pendente da carteira, já com a quantidade que falta em cada etapa. */
export interface ItemCarteira {
  orcamento_id: string
  /** m² da peça (corte) */
  area_total: number
  /** ml de borda trabalhada da peça (acabamento e instalação) */
  ml: number
  cortado: boolean
  acabado: boolean
  instalado: boolean
}

export interface Janela {
  inicio: string
  fim: string // inclusivo
}

export function janelaDeSemanas(semanas = JANELA_SEMANAS, hoje = new Date()): Janela {
  const fim = new Date(hoje)
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - semanas * 7 + 1)
  return { inicio: isoLocal(inicio), fim: isoLocal(fim) }
}

export function dentroDaJanela(data: string, j: Janela): boolean {
  return data >= j.inicio && data <= j.fim
}

// ── ml equivalente ────────────────────────────────────────────────────
// Reto e meia esquadria são trabalhos de esforço diferente; somar os dois
// crus mediria errado. `fator_meia_esquadria` converte 1 ml de ME em ml de
// reto. Começa em 1 (ME = reto) e é recalibrado com `fatorMEsugerido`.
export function mlEquivalente(
  linhas: Pick<ApontamentoCapacidade, 'quantidade' | 'tipo_acabamento'>[],
  fatorME: number
): number {
  return linhas.reduce((s, l) => {
    const peso = l.tipo_acabamento === 'meia_esquadria' ? fatorME : 1
    return s + (l.quantidade || 0) * peso
  }, 0)
}

/**
 * Fator ME medido: média ml/dia em dias em que a pessoa SÓ fez reto,
 * dividida pela média ml/dia em dias em que SÓ fez meia esquadria. Dia
 * misto é descartado — ele não diz nada sobre o ritmo de nenhum dos dois.
 * Devolve `null` enquanto não houver dias dos dois tipos.
 *
 * É só uma sugestão: quem confirma o fator é o gestor, em Configurações.
 */
export function fatorMEsugerido(apontamentos: ApontamentoCapacidade[]): number | null {
  const acab = apontamentos.filter(a => a.etapa === 'acabamento')
  // Chave por pessoa+dia: o ritmo é individual, misturar pessoas num mesmo
  // dia faria a média depender de quantos trabalharam naquele dia.
  const porDia = new Map<string, { reto: number; me: number }>()
  for (const a of acab) {
    const k = `${a.funcionario_id ?? '?'}|${a.data}`
    const acc = porDia.get(k) ?? { reto: 0, me: 0 }
    if (a.tipo_acabamento === 'meia_esquadria') acc.me += a.quantidade || 0
    else acc.reto += a.quantidade || 0
    porDia.set(k, acc)
  }

  const sóReto: number[] = []
  const sóME: number[] = []
  for (const { reto, me } of porDia.values()) {
    if (reto > 0 && me === 0) sóReto.push(reto)
    else if (me > 0 && reto === 0) sóME.push(me)
  }
  if (sóReto.length === 0 || sóME.length === 0) return null

  const mediaReto = sóReto.reduce((s, v) => s + v, 0) / sóReto.length
  const mediaME = sóME.reduce((s, v) => s + v, 0) / sóME.length
  if (mediaME <= 0) return null
  return mediaReto / mediaME
}

// ── Produtividade individual ──────────────────────────────────────────

export interface ProdutividadePessoa {
  pessoaId: string
  nome: string
  etapa: EtapaProducao
  /** m²/dia (corte) ou ml/dia (acabamento em ml eq., instalação em ml) */
  mediaDia: number
  total: number
  /**
   * Denominador usado. 'presenca' = dias marcados como presente (o padrão
   * da spec). 'apontamentos' = dias distintos com produção — usado quando a
   * pessoa não tem presença lançada, caso dos instaladores, que são pagos
   * por metro e não por diária.
   */
  base: 'presenca' | 'apontamentos'
  dias: number
  /** Menos de 10 dias de dados: o número aparece em cinza na tela. */
  dadosInsuficientes: boolean
  unidade: string
}

export function produtividadePorPessoa(
  pessoas: Pessoa[],
  apontamentos: ApontamentoCapacidade[],
  presencas: PresencaCapacidade[],
  janela: Janela,
  fatorME: number
): ProdutividadePessoa[] {
  const naJanela = apontamentos.filter(a => dentroDaJanela(a.data, janela))
  const presNaJanela = presencas.filter(p => dentroDaJanela(p.data, janela) && p.presente)

  const resultado: ProdutividadePessoa[] = []

  for (const pessoa of pessoas) {
    const cadastroIds = new Set(pessoa.cadastros.map(c => c.id))

    // Presença pode estar lançada em qualquer cadastro da pessoa (na Real
    // Pedras está no cadastro interno de acabador) — conta dias distintos
    // pra não dobrar quem tem dois cadastros marcados no mesmo dia.
    const diasPresentes = new Set(
      presNaJanela.filter(p => cadastroIds.has(p.funcionario_id)).map(p => p.data)
    )

    for (const etapa of ETAPAS) {
      if (!pessoa.cadastroPorEtapa[etapa]) continue
      const linhas = naJanela.filter(a =>
        a.etapa === etapa && a.funcionario_id && cadastroIds.has(a.funcionario_id)
      )
      if (linhas.length === 0) continue

      const total = etapa === 'acabamento'
        ? mlEquivalente(linhas, fatorME)
        : linhas.reduce((s, l) => s + (l.quantidade || 0), 0)

      const diasComProducao = new Set(linhas.map(l => l.data))
      const base: 'presenca' | 'apontamentos' = diasPresentes.size > 0 ? 'presenca' : 'apontamentos'
      const dias = base === 'presenca' ? diasPresentes.size : diasComProducao.size

      resultado.push({
        pessoaId: pessoa.pessoaId,
        nome: pessoa.nome,
        etapa,
        total,
        mediaDia: dias > 0 ? total / dias : 0,
        base,
        dias,
        dadosInsuficientes: dias < MIN_DIAS_CONFIAVEL,
        unidade: UNIDADE_ETAPA[etapa],
      })
    }
  }

  return resultado.sort((a, b) => b.mediaDia - a.mediaDia)
}

/**
 * Capacidade do time por etapa: soma das produtividades individuais de quem
 * está ativo. Quem tem dados insuficientes entra na soma de propósito — o
 * time precisa contar com a pessoa mesmo com a medida ainda grosseira — mas
 * a tela mostra quantos estão nessa situação.
 */
export function capacidadeDoTime(
  produtividades: ProdutividadePessoa[]
): Record<EtapaProducao, { porDia: number; pessoas: number; pessoasComPoucoDado: number }> {
  const out = {} as Record<EtapaProducao, { porDia: number; pessoas: number; pessoasComPoucoDado: number }>
  for (const etapa of ETAPAS) {
    const doEtapa = produtividades.filter(p => p.etapa === etapa && p.mediaDia > 0)
    out[etapa] = {
      porDia: doEtapa.reduce((s, p) => s + p.mediaDia, 0),
      pessoas: doEtapa.length,
      pessoasComPoucoDado: doEtapa.filter(p => p.dadosInsuficientes).length,
    }
  }
  return out
}

// ── Carteira e fila ───────────────────────────────────────────────────

export interface Carteira {
  corte: number        // m²
  acabamento: number   // ml (eq. não se aplica: a carteira não sabe o tipo ainda)
  instalacao: number   // ml
  pedidos: number
}

/**
 * Carteira = o que está vendido e ainda não foi feito. Peça sem
 * `cortado_em` entra na fila de corte, sem `acabado_em` na de acabamento, e
 * assim por diante — a mesma marcação que a Fila e a ficha gravam.
 *
 * O ml da carteira é ml cru, não equivalente: o tipo (R/ME) só é conhecido
 * quando a peça é feita. Na prática isso subestima a fila quando o fator ME
 * é maior que 1, e é o melhor que dá pra saber antes de executar.
 */
export function carteiraPendente(itens: ItemCarteira[]): Carteira {
  const c: Carteira = { corte: 0, acabamento: 0, instalacao: 0, pedidos: 0 }
  const pedidos = new Set<string>()
  for (const i of itens) {
    let entrou = false
    if (!i.cortado && i.area_total > 0) { c.corte += i.area_total; entrou = true }
    if (!i.acabado && i.ml > 0) { c.acabamento += i.ml; entrou = true }
    if (!i.instalado && i.ml > 0) { c.instalacao += i.ml; entrou = true }
    if (entrou) pedidos.add(i.orcamento_id)
  }
  c.pedidos = pedidos.size
  return c
}

export interface FilaEtapa {
  etapa: EtapaProducao
  carteira: number
  capacidadeDia: number
  /** null quando ainda não há capacidade medida pra essa etapa */
  diasUteis: number | null
  unidade: string
}

export function filaPorEtapa(
  carteira: Carteira,
  capacidade: Record<EtapaProducao, { porDia: number }>
): FilaEtapa[] {
  return ETAPAS.map(etapa => {
    const pendente = carteira[etapa]
    const porDia = capacidade[etapa]?.porDia ?? 0
    return {
      etapa,
      carteira: pendente,
      capacidadeDia: porDia,
      diasUteis: porDia > 0 ? Math.ceil(pendente / porDia) : null,
      unidade: UNIDADE_ETAPA[etapa],
    }
  })
}

/** Etapa com mais dias de fila — onde o pedido realmente espera. */
export function gargalo(filas: FilaEtapa[]): FilaEtapa | null {
  const medidas = filas.filter(f => f.diasUteis !== null && f.diasUteis > 0)
  if (medidas.length === 0) return null
  return medidas.reduce((pior, f) => ((f.diasUteis ?? 0) > (pior.diasUteis ?? 0) ? f : pior))
}

/**
 * Prazo estimado: os dias de fila do gargalo + 1 dia por etapa seguinte
 * (as etapas depois do gargalo não acumulam fila, só o tempo de passar por
 * elas). Em dias ÚTEIS — sábado conta como dia útil aqui, porque a fábrica
 * trabalha de segunda a sábado (é o que a ficha e a presença registram).
 */
export function prazoEstimado(filas: FilaEtapa[], hoje = new Date()): { diasUteis: number; data: string; gargalo: EtapaProducao } | null {
  const g = gargalo(filas)
  if (!g) return null
  const indiceGargalo = ETAPAS.indexOf(g.etapa)
  const etapasDepois = ETAPAS.length - 1 - indiceGargalo
  const diasUteis = (g.diasUteis ?? 0) + etapasDepois
  return { diasUteis, data: somarDiasUteis(hoje, diasUteis), gargalo: g.etapa }
}

/** Soma dias úteis a partir de uma data. Semana útil = seg a sáb. */
export function somarDiasUteis(de: Date, dias: number): string {
  const d = new Date(de)
  d.setHours(12, 0, 0, 0)
  let restantes = dias
  while (restantes > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) restantes-- // domingo não conta
  }
  return isoLocal(d)
}

// ── Custos ────────────────────────────────────────────────────────────

export interface CustoUnitario {
  /** R$ por ml eq. (acabamento) / m² (corte) / ml (instalação) */
  valor: number | null
  /** diárias somadas (acabamento/corte) ou valor aprovado (instalação) */
  custoTotal: number
  quantidadeTotal: number
  dias: number
}

/**
 * Custo por ml acabado = diária registrada na presença daquele dia ÷ ml eq.
 * daquele dia, em média ponderada (soma das diárias ÷ soma dos ml).
 *
 * Dia misto (a pessoa acabou E instalou no mesmo dia): a diária inteira
 * conta como custo de acabamento. É uma simplificação consciente — a
 * instalação já é paga por metro à parte, então ratear a diária contaria o
 * mesmo custo duas vezes. A spec pede pra revisar isso depois de 4 semanas
 * de dados.
 */
export function custoPorUnidade(
  etapa: 'corte' | 'acabamento',
  pessoas: Pessoa[],
  apontamentos: ApontamentoCapacidade[],
  presencas: PresencaCapacidade[],
  janela: Janela,
  fatorME: number
): CustoUnitario {
  const naJanela = apontamentos.filter(a => a.etapa === etapa && dentroDaJanela(a.data, janela))
  const presNaJanela = presencas.filter(p => p.presente && dentroDaJanela(p.data, janela))

  // Mapa cadastro → pessoa, pra casar a presença (lançada num cadastro) com
  // a produção (lançada possivelmente no outro).
  const pessoaDoCadastro = new Map<string, string>()
  for (const p of pessoas) for (const c of p.cadastros) pessoaDoCadastro.set(c.id, p.pessoaId)

  // Diária por pessoa+dia — dedup: dois cadastros marcados no mesmo dia são
  // a mesma diária, não duas.
  const diariaPorPessoaDia = new Map<string, number>()
  for (const pr of presNaJanela) {
    const pessoaId = pessoaDoCadastro.get(pr.funcionario_id)
    if (!pessoaId) continue
    const k = `${pessoaId}|${pr.data}`
    const valor = Number(pr.valor_diaria ?? 0)
    diariaPorPessoaDia.set(k, Math.max(diariaPorPessoaDia.get(k) ?? 0, valor))
  }

  const quantidadePorPessoaDia = new Map<string, number>()
  for (const a of naJanela) {
    const pessoaId = a.funcionario_id ? pessoaDoCadastro.get(a.funcionario_id) : null
    if (!pessoaId) continue
    const k = `${pessoaId}|${a.data}`
    const q = etapa === 'acabamento' ? mlEquivalente([a], fatorME) : (a.quantidade || 0)
    quantidadePorPessoaDia.set(k, (quantidadePorPessoaDia.get(k) ?? 0) + q)
  }

  // Só entram dias que têm diária E produção: um dia com produção e sem
  // diária lançada inflaria o denominador (custo artificialmente baixo); um
  // dia com diária e sem produção é "dia sem lançamento", que a grade
  // semanal destaca em amarelo pro gestor corrigir — não é custo por ml.
  let custoTotal = 0
  let quantidadeTotal = 0
  let dias = 0
  for (const [k, quantidade] of quantidadePorPessoaDia) {
    const diaria = diariaPorPessoaDia.get(k)
    if (!diaria || diaria <= 0 || quantidade <= 0) continue
    custoTotal += diaria
    quantidadeTotal += quantidade
    dias++
  }

  return {
    valor: quantidadeTotal > 0 ? custoTotal / quantidadeTotal : null,
    custoTotal,
    quantidadeTotal,
    dias,
  }
}

/**
 * Custo por ml instalado = valor aprovado ÷ ml instalado. Só apontamentos
 * aprovados: pendente ainda pode mudar de valor no fechamento de sexta.
 */
export function custoPorMlInstalado(apontamentos: ApontamentoCapacidade[], janela: Janela): CustoUnitario {
  const linhas = apontamentos.filter(a =>
    a.etapa === 'instalacao' && a.status === 'aprovado' && dentroDaJanela(a.data, janela)
  )
  const custoTotal = linhas.reduce((s, a) => s + Number(a.valor_calculado ?? 0), 0)
  const quantidadeTotal = linhas.reduce((s, a) => s + (a.quantidade || 0), 0)
  return {
    valor: quantidadeTotal > 0 ? custoTotal / quantidadeTotal : null,
    custoTotal,
    quantidadeTotal,
    dias: new Set(linhas.map(a => a.data)).size,
  }
}

// ── Vendido × Produzido × Entregue ────────────────────────────────────

export interface VendidoProduzidoEntregue {
  vendido: { m2: number; ml: number }
  produzido: { m2: number; mlEq: number }
  entregue: { ml: number }
}

/**
 * Compara, no mesmo mês, o que entrou (vendido, por `data_fechamento`), o
 * que a fábrica fez (produzido, pela `data` do apontamento de corte e
 * acabamento) e o que foi instalado. Os três quase nunca batem — e a
 * diferença é exatamente o estoque em processo.
 */
export function vendidoProduzidoEntregue(
  vendidos: { m2: number; ml: number },
  apontamentos: ApontamentoCapacidade[],
  periodo: Janela,
  fatorME: number
): VendidoProduzidoEntregue {
  const noPeriodo = apontamentos.filter(a => dentroDaJanela(a.data, periodo))
  return {
    vendido: vendidos,
    produzido: {
      m2: noPeriodo.filter(a => a.etapa === 'corte').reduce((s, a) => s + (a.quantidade || 0), 0),
      mlEq: mlEquivalente(noPeriodo.filter(a => a.etapa === 'acabamento'), fatorME),
    },
    entregue: {
      ml: noPeriodo.filter(a => a.etapa === 'instalacao').reduce((s, a) => s + (a.quantidade || 0), 0),
    },
  }
}

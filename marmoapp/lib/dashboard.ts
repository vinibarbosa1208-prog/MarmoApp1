import type { Orcamento, OrcamentoItem, Servico } from './types'
import { orcTotal } from './utils'

// === Métricas do Dashboard ===
// Base de tempo: data_fechamento (dia em que o orçamento foi aprovado).
// "Produção do mês" = tudo que foi VENDIDO (aprovado) no mês — é o que a
// fábrica vai cortar/acabar. Quando os apontamentos de produção estiverem
// completos, dá pra trocar a base para acabado_em sem mudar a tela.

export type Periodo = { inicio: string; fim: string } // 'YYYY-MM-DD', inclusivo

export function periodoDoMes(ano: number, mes0: number): Periodo {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ultimo = new Date(ano, mes0 + 1, 0).getDate()
  return { inicio: `${ano}-${pad(mes0 + 1)}-01`, fim: `${ano}-${pad(mes0 + 1)}-${pad(ultimo)}` }
}

export function periodoDoAno(ano: number): Periodo {
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
  return isNaN(n) ? 0 : n
}

// Remove acentos e padroniza pra agrupar "Meia Esquadria" e "meia esquadria"
export function normalizar(s: string | undefined | null): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Nome exibido: "PRETO SÃO GABRIEL" / "preto são gabriel" → "Preto São Gabriel"
function tituloBonito(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
}

// Data local YYYY-MM-DD de um timestamp (created_at vem em UTC)
function dataLocal(ts?: string | null): string {
  if (!ts) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dataFechamento(o: Orcamento): string {
  return (o as Orcamento & { data_fechamento?: string | null }).data_fechamento || ''
}

export function aprovadosNoPeriodo(orcamentos: Orcamento[], p: Periodo): Orcamento[] {
  return orcamentos.filter(o => {
    const df = dataFechamento(o)
    return o.status === 'aprovado' && !!df && df >= p.inicio && df <= p.fim
  })
}

// ---------- Acabamentos ----------
export type TipoAcabamento = 'meia_esquadria' | 'reto' | 'outros'

export const ACABAMENTO_LABELS: Record<TipoAcabamento, string> = {
  meia_esquadria: 'Meia esquadria',
  reto: 'Acabamento reto',
  outros: 'Outros acabamentos',
}

// Classifica uma linha de serviço pelo nome. Retorna null se não for acabamento.
export function classificarAcabamento(descricao: string): TipoAcabamento | null {
  const d = normalizar(descricao)
  if (d.includes('esquadria')) return 'meia_esquadria'
  if (d.startsWith('acabamento reto') || d === 'reto') return 'reto'
  if (d.startsWith('acabamento') || d.includes('meia cana') || d.includes('boleado') || d.includes('chanfr') || d.includes('bisot') || d.includes('filete')) return 'outros'
  return null
}

function ehColocacao(descricao: string): boolean {
  return normalizar(descricao).startsWith('coloca')
}

// Metros lineares marcados nos lados da peça (desenho técnico)
function mlBordasPorTipo(i: OrcamentoItem): Record<TipoAcabamento, number> {
  const r: Record<TipoAcabamento, number> = { meia_esquadria: 0, reto: 0, outros: 0 }
  const q = num(i.quantidade) || 1
  const lados: [string | undefined, number][] = [
    [i.acabamento_frente, num(i.largura)],
    [i.acabamento_fundo, num(i.largura)],
    [i.acabamento_esquerda, num(i.altura)],
    [i.acabamento_direita, num(i.altura)],
  ]
  for (const [tipo, med] of lados) {
    if (!tipo || tipo === 'frontao' || tipo === 'nenhum') continue
    const k: TipoAcabamento = tipo === 'meia_esquadria' ? 'meia_esquadria' : tipo === 'reto' ? 'reto' : 'outros'
    r[k] += med * q
  }
  return r
}

// ml de acabamento de UM orçamento. Fonte principal: as linhas de serviço
// ("Acabamento meia esquadria", "Acabamento reto"...), que é o que foi
// cobrado do cliente. Se o orçamento não tiver nenhuma linha de serviço de
// acabamento, usa os lados marcados nas peças como alternativa — assim não
// conta em dobro quando os dois existem.
export function acabamentosDoOrcamento(o: Orcamento): Record<TipoAcabamento, number> {
  const r: Record<TipoAcabamento, number> = { meia_esquadria: 0, reto: 0, outros: 0 }
  const itens = o.itens || []
  let temServico = false
  for (const i of itens) {
    if (i.tipo !== 'servico') continue
    const k = classificarAcabamento(i.descricao)
    if (!k) continue
    temServico = true
    r[k] += num(i.quantidade)
  }
  if (!temServico) {
    for (const i of itens) {
      if (i.tipo !== 'material') continue
      const b = mlBordasPorTipo(i)
      r.meia_esquadria += b.meia_esquadria; r.reto += b.reto; r.outros += b.outros
    }
  }
  return r
}

// m² de pedra de um item de material. Quando a área não foi calculada
// (lançamento manual), a quantidade já é a metragem.
function m2Item(i: OrcamentoItem): number {
  const area = num(i.area)
  return area > 0 ? area * (num(i.quantidade) || 1) : num(i.quantidade)
}

// ---------- Resumo do período ----------
export type Ranking = { nome: string; valor: number; qtd: number; pedidos: number; unidade?: string }

export type ResumoPeriodo = {
  pedidos: number
  receita: number
  ticketMedio: number
  receitaMaterial: number
  custoMaterial: number
  margemMaterialPct: number | null
  m2Material: number
  acabamentos: Record<TipoAcabamento, number>
  outrosAcabamentosPorNome: Ranking[]
  colocacaoMl: number
  pecas: number
  materiais: Ranking[]
  tiposPeca: Ranking[]
  servicos: Ranking[]
  criados: number
  criadosAprovados: number
  conversaoPct: number | null
}

export const TIPO_PECA_LABELS: Record<string, string> = {
  soleira: 'Soleira / Peitoril',
  bancada_simples: 'Bancada',
  pia_l: 'Pia em L',
  pia_retangular: 'Pia retangular',
  lavatorio_simples: 'Lavatório',
  lavatorio_extensao: 'Lavatório c/ extensão',
  nicho: 'Nicho',
  ilha_cozinha: 'Ilha de cozinha',
}

export function resumoPeriodo(orcamentos: Orcamento[], p: Periodo, servicosCadastro: Servico[] = []): ResumoPeriodo {
  const vendas = aprovadosNoPeriodo(orcamentos, p)
  const receita = vendas.reduce((s, o) => s + orcTotal(o), 0)

  const acab: Record<TipoAcabamento, number> = { meia_esquadria: 0, reto: 0, outros: 0 }
  const outrosNome = new Map<string, Ranking>()
  const mat = new Map<string, Ranking>()
  const pec = new Map<string, Ranking>()
  const svc = new Map<string, Ranking>()
  const unidadePorServico = new Map(servicosCadastro.map(s => [normalizar(s.nome), s.unidade || '']))

  let receitaMaterial = 0, custoMaterial = 0, m2Material = 0, colocacaoMl = 0, pecas = 0

  const somar = (m: Map<string, Ranking>, chave: string, nome: string, valor: number, qtd: number, orcId: string, seen: Set<string>, unidade?: string) => {
    const r = m.get(chave) || { nome, valor: 0, qtd: 0, pedidos: 0, unidade }
    r.valor += valor; r.qtd += qtd
    const k = chave + '|' + orcId
    if (!seen.has(k)) { seen.add(k); r.pedidos += 1 }
    m.set(chave, r)
  }
  const seen = new Set<string>()

  for (const o of vendas) {
    const a = acabamentosDoOrcamento(o)
    acab.meia_esquadria += a.meia_esquadria; acab.reto += a.reto; acab.outros += a.outros

    for (const i of o.itens || []) {
      const total = num(i.total_item ?? i.total)
      if (i.tipo === 'material') {
        const m2 = m2Item(i)
        receitaMaterial += total
        custoMaterial += num(i.custo_item)
        m2Material += m2
        const nomeMat = (i.descricao || '').trim() || 'Sem nome'
        somar(mat, 'm:' + normalizar(nomeMat), tituloBonito(nomeMat), total, m2, o.id, seen, 'm²')
        if (i.tipo_peca && i.tipo_peca !== 'servico') {
          const q = num(i.quantidade) > 0 && num(i.area) > 0 ? num(i.quantidade) : 1
          pecas += q
          const label = TIPO_PECA_LABELS[i.tipo_peca] || tituloBonito(i.tipo_peca.replace(/_/g, ' '))
          somar(pec, 'p:' + i.tipo_peca, label, total, q, o.id, seen, 'pç')
        }
      } else if (i.tipo === 'servico') {
        const nomeSvc = (i.descricao || '').trim() || 'Serviço'
        const qtd = num(i.quantidade)
        const unidade = unidadePorServico.get(normalizar(nomeSvc)) || (classificarAcabamento(nomeSvc) || ehColocacao(nomeSvc) ? 'ml' : '')
        somar(svc, 's:' + normalizar(nomeSvc), tituloBonito(nomeSvc), total, qtd, o.id, seen, unidade)
        if (ehColocacao(nomeSvc)) colocacaoMl += qtd
        if (classificarAcabamento(nomeSvc) === 'outros') {
          somar(outrosNome, 'o:' + normalizar(nomeSvc), tituloBonito(nomeSvc), total, qtd, o.id, seen, 'ml')
        }
      }
    }
  }

  const criadosLista = orcamentos.filter(o => {
    const d = dataLocal(o.created_at)
    return d >= p.inicio && d <= p.fim
  })
  const criadosAprovados = criadosLista.filter(o => o.status === 'aprovado').length

  const ordenar = (m: Map<string, Ranking>, por: 'valor' | 'qtd' = 'valor') =>
    [...m.values()].sort((a, b) => b[por] - a[por])

  return {
    pedidos: vendas.length,
    receita,
    ticketMedio: vendas.length ? receita / vendas.length : 0,
    receitaMaterial,
    custoMaterial,
    margemMaterialPct: receitaMaterial > 0 && custoMaterial > 0 ? (receitaMaterial - custoMaterial) / receitaMaterial * 100 : null,
    m2Material,
    acabamentos: acab,
    outrosAcabamentosPorNome: ordenar(outrosNome, 'qtd'),
    colocacaoMl,
    pecas,
    materiais: ordenar(mat, 'qtd'),
    tiposPeca: ordenar(pec, 'qtd'),
    servicos: ordenar(svc, 'valor'),
    criados: criadosLista.length,
    criadosAprovados,
    conversaoPct: criadosLista.length ? criadosAprovados / criadosLista.length * 100 : null,
  }
}

// Receita e acabamentos mês a mês (para o gráfico de evolução)
export type PontoMensal = { chave: string; label: string; ano: number; mes0: number; receita: number; pedidos: number; meiaEsquadria: number; reto: number }

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function serieMensal(orcamentos: Orcamento[], anoFim: number, mes0Fim: number, meses = 12): PontoMensal[] {
  const out: PontoMensal[] = []
  for (let k = meses - 1; k >= 0; k--) {
    const d = new Date(anoFim, mes0Fim - k, 1)
    const ano = d.getFullYear(), mes0 = d.getMonth()
    const vendas = aprovadosNoPeriodo(orcamentos, periodoDoMes(ano, mes0))
    let me = 0, reto = 0
    for (const o of vendas) { const a = acabamentosDoOrcamento(o); me += a.meia_esquadria; reto += a.reto }
    out.push({
      chave: `${ano}-${mes0}`,
      label: `${MESES_CURTOS[mes0]}${mes0 === 0 || k === meses - 1 ? '/' + String(ano).slice(2) : ''}`,
      ano, mes0,
      receita: vendas.reduce((s, o) => s + orcTotal(o), 0),
      pedidos: vendas.length,
      meiaEsquadria: me,
      reto,
    })
  }
  return out
}

// Variação % entre atual e anterior (null quando não há base de comparação)
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return (atual - anterior) / anterior * 100
}

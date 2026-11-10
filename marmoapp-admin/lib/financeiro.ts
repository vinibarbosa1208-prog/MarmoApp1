// Financeiro interno do MarmoApp: tipos, categorias e a expansão das recorrências
// em datas (ocorrências). Sem dependências de servidor: usado também no navegador.
import { addDays, addMonths, format, parseISO } from 'date-fns'

export type TipoLancamento = 'entrada' | 'saida'
export type Recorrencia = 'unica' | 'semanal' | 'quinzenal' | 'mensal'
export type StatusLancamento = 'previsto' | 'realizado' | 'cancelado'
export type StatusOcorrencia = StatusLancamento | 'atrasado'
export type TipoCliente = 'contratante' | 'cadastro' | 'teste' | 'interno'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  categoria: string
  descricao: string
  valor: number
  data_prevista: string
  recorrencia: Recorrencia
  recorrencia_fim: string | null
  status: StatusLancamento
  data_realizada: string | null
  origem_id: string | null
  marmoraria_id: string | null
  investimento_id: string | null
  observacao: string | null
}

export interface Ocorrencia {
  chave: string
  lancamento_id: string // recorrência (ou o próprio lançamento, se único)
  registro_id: string | null // lançamento filho que registrou recebimento/pagamento/pulo
  data: string
  valor: number
  tipo: TipoLancamento
  categoria: string
  descricao: string
  status: StatusOcorrencia
  data_realizada: string | null
  recorrente: boolean
  recorrencia: Recorrencia
  marmoraria_id: string | null
  investimento_id: string | null
}

export interface Investimento {
  id: string
  nome: string
  canal: string
  utm_campaign: string | null
  inicio: string | null
  fim: string | null
  orcamento: number
  status: 'planejado' | 'ativo' | 'pausado' | 'encerrado'
  observacao: string | null
}

export const CATEGORIAS: Record<TipoLancamento, { valor: string; nome: string }[]> = {
  entrada: [
    { valor: 'mensalidade', nome: 'Mensalidade de cliente' },
    { valor: 'implantacao', nome: 'Implantação' },
    { valor: 'servico_extra', nome: 'Serviço extra' },
    { valor: 'aporte', nome: 'Aporte / investimento recebido' },
    { valor: 'outros', nome: 'Outras entradas' },
  ],
  saida: [
    { valor: 'marketing', nome: 'Marketing e anúncios' },
    { valor: 'ferramentas', nome: 'Ferramentas e assinaturas' },
    { valor: 'infraestrutura', nome: 'Infraestrutura (servidor, Vercel, Supabase)' },
    { valor: 'ia', nome: 'IA (Anthropic, Whisper)' },
    { valor: 'pessoal', nome: 'Pessoas e pró-labore' },
    { valor: 'impostos', nome: 'Impostos e contabilidade' },
    { valor: 'outros', nome: 'Outras saídas' },
  ],
}

export function nomeCategoria(tipo: TipoLancamento, valor: string) {
  return CATEGORIAS[tipo].find((c) => c.valor === valor)?.nome ?? valor
}

export const RECORRENCIAS: { valor: Recorrencia; nome: string }[] = [
  { valor: 'unica', nome: 'Uma vez' },
  { valor: 'semanal', nome: 'Toda semana' },
  { valor: 'quinzenal', nome: 'A cada 15 dias' },
  { valor: 'mensal', nome: 'Todo mês' },
]

export const CANAIS: { valor: string; nome: string }[] = [
  { valor: 'meta', nome: 'Meta (Facebook/Instagram Ads)' },
  { valor: 'google', nome: 'Google Ads' },
  { valor: 'instagram', nome: 'Instagram orgânico' },
  { valor: 'indicacao', nome: 'Indicação' },
  { valor: 'evento', nome: 'Evento / feira' },
  { valor: 'outro', nome: 'Outro' },
]

export const TIPOS_CLIENTE: { valor: TipoCliente; nome: string; ajuda: string }[] = [
  { valor: 'contratante', nome: 'Contratante', ajuda: 'Paga o MarmoApp' },
  { valor: 'cadastro', nome: 'Cadastro', ajuda: 'Criou conta, ainda não paga' },
  { valor: 'teste', nome: 'Teste', ajuda: 'Conta de teste ou duplicada' },
  { valor: 'interno', nome: 'Interno', ajuda: 'Conta do time MarmoApp' },
]

export const COR_TIPO: Record<TipoCliente, string> = {
  contratante: 'bg-[rgba(201,168,76,0.15)] text-gold-dk border-[rgba(201,168,76,0.45)]',
  cadastro: 'bg-gray-100 text-gray-700 border-gray-200',
  teste: 'bg-gray-50 text-gray-400 border-gray-200',
  interno: 'bg-gray-50 text-gray-400 border-gray-200',
}

/** Data de hoje no horário de Brasília, em yyyy-MM-dd. */
export function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function somarDias(data: string, dias: number) {
  return format(addDays(parseISO(data), dias), 'yyyy-MM-dd')
}

export function somarMeses(data: string, meses: number) {
  return format(addMonths(parseISO(data), meses), 'yyyy-MM-dd')
}

function proxima(data: string, rec: Recorrencia, inicio: string, n: number) {
  if (rec === 'semanal') return somarDias(data, 7)
  if (rec === 'quinzenal') return somarDias(data, 14)
  // mensal: sempre a partir do início para não "escorregar" do dia 31 para o 28
  return somarMeses(inicio, n)
}

/**
 * Transforma lançamentos (únicos, recorrências e registros filhos) em ocorrências
 * datadas dentro do intervalo [de, ate].
 */
export function expandir(lancamentos: Lancamento[], de: string, ate: string, hoje = hojeBR()): Ocorrencia[] {
  const filhos = new Map<string, Lancamento>()
  for (const l of lancamentos) if (l.origem_id) filhos.set(`${l.origem_id}:${l.data_prevista}`, l)

  const out: Ocorrencia[] = []
  const status = (s: StatusLancamento, data: string): StatusOcorrencia =>
    s === 'previsto' && data < hoje ? 'atrasado' : s

  for (const l of lancamentos) {
    if (l.origem_id) continue
    const base = {
      lancamento_id: l.id,
      tipo: l.tipo,
      categoria: l.categoria,
      descricao: l.descricao,
      recorrencia: l.recorrencia,
      recorrente: l.recorrencia !== 'unica',
      marmoraria_id: l.marmoraria_id,
      investimento_id: l.investimento_id,
    }

    if (l.recorrencia === 'unica') {
      if (l.data_prevista < de || l.data_prevista > ate) continue
      out.push({
        ...base,
        chave: l.id,
        registro_id: null,
        data: l.data_prevista,
        valor: Number(l.valor),
        status: status(l.status, l.data_prevista),
        data_realizada: l.data_realizada,
      })
      continue
    }

    if (l.status === 'cancelado') continue
    const fim = l.recorrencia_fim && l.recorrencia_fim < ate ? l.recorrencia_fim : ate
    let data = l.data_prevista
    let n = 0
    while (data <= fim && n < 1000) {
      if (data >= de) {
        const f = filhos.get(`${l.id}:${data}`)
        out.push({
          ...base,
          chave: `${l.id}:${data}`,
          registro_id: f?.id ?? null,
          data,
          valor: Number(f?.valor ?? l.valor),
          status: f ? f.status : status('previsto', data),
          data_realizada: f?.data_realizada ?? null,
        })
      }
      n++
      data = proxima(data, l.recorrencia, l.data_prevista, n)
    }
  }

  return out.sort((a, b) => (a.data === b.data ? a.descricao.localeCompare(b.descricao) : a.data < b.data ? -1 : 1))
}

/** Valor mensal equivalente de uma recorrência (semana = 52/12 por mês). */
export function valorMensal(valor: number, rec: Recorrencia) {
  if (rec === 'semanal') return (valor * 52) / 12
  if (rec === 'quinzenal') return (valor * 26) / 12
  if (rec === 'mensal') return valor
  return 0
}

/** Recorrências de entrada ainda ativas, ligadas a clientes. */
export function recorrenciasAtivas(lancamentos: Lancamento[], hoje = hojeBR()) {
  return lancamentos.filter(
    (l) =>
      !l.origem_id &&
      l.tipo === 'entrada' &&
      l.recorrencia !== 'unica' &&
      l.status !== 'cancelado' &&
      (!l.recorrencia_fim || l.recorrencia_fim >= hoje),
  )
}

export function receitaRecorrenteMensal(lancamentos: Lancamento[], hoje = hojeBR()) {
  return recorrenciasAtivas(lancamentos, hoje)
    .filter((l) => l.marmoraria_id)
    .reduce((s, l) => s + valorMensal(Number(l.valor), l.recorrencia), 0)
}

export function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function dataBR(d: string | null) {
  if (!d) return '—'
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

export const ROTULO_STATUS: Record<StatusOcorrencia, string> = {
  previsto: 'Previsto',
  atrasado: 'Atrasado',
  realizado: 'Realizado',
  cancelado: 'Pulado',
}

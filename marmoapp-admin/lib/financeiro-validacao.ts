// Validação das entradas das APIs do financeiro interno.
import { CATEGORIAS, CANAIS, type Recorrencia, type TipoLancamento } from '@/lib/financeiro'

const DATA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

export function data(v: unknown): string | null {
  return typeof v === 'string' && DATA.test(v) && !Number.isNaN(Date.parse(v)) ? v : null
}

export function uuid(v: unknown): string | null {
  return typeof v === 'string' && UUID.test(v) ? v : null
}

export function texto(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function valor(v: unknown): number | null {
  const n =
    typeof v === 'string' && v.includes(',') ? Number(v.replace(/\./g, '').replace(',', '.')) : Number(v)
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null
}

/** Lê um lançamento do corpo da requisição. `novo` exige todos os campos obrigatórios. */
export function lerLancamento(b: Record<string, unknown>, novo: boolean) {
  const out: Record<string, unknown> = {}

  if (novo || 'tipo' in b) {
    if (b.tipo !== 'entrada' && b.tipo !== 'saida') return 'Escolha entrada ou saída.'
    out.tipo = b.tipo
  }
  const tipo = (out.tipo ?? b.tipo) as TipoLancamento | undefined
  if (novo || 'categoria' in b) {
    const c = texto(b.categoria, 40)
    if (!tipo || !CATEGORIAS[tipo]?.some((x) => x.valor === c)) return 'Escolha uma categoria.'
    out.categoria = c
  }
  if (novo || 'descricao' in b) {
    const d = texto(b.descricao)
    if (!d) return 'Descreva o lançamento.'
    out.descricao = d
  }
  if (novo || 'valor' in b) {
    const v = valor(b.valor)
    if (v == null) return 'Informe um valor maior que zero.'
    out.valor = v
  }
  if (novo || 'data_prevista' in b) {
    const d = data(b.data_prevista)
    if (!d) return 'Informe a data.'
    out.data_prevista = d
  }
  if (novo || 'recorrencia' in b) {
    const r = (b.recorrencia ?? 'unica') as Recorrencia
    if (!['unica', 'semanal', 'quinzenal', 'mensal'].includes(r)) return 'Recorrência inválida.'
    out.recorrencia = r
  }
  if ('recorrencia_fim' in b) {
    if (b.recorrencia_fim === null || b.recorrencia_fim === '') out.recorrencia_fim = null
    else {
      const d = data(b.recorrencia_fim)
      if (!d) return 'Data final da recorrência inválida.'
      out.recorrencia_fim = d
    }
  }
  if ('marmoraria_id' in b) out.marmoraria_id = uuid(b.marmoraria_id)
  if ('investimento_id' in b) out.investimento_id = uuid(b.investimento_id)
  if ('observacao' in b) out.observacao = texto(b.observacao, 1000) || null

  if (novo && b.status === 'realizado' && out.recorrencia === 'unica') {
    out.status = 'realizado'
    out.data_realizada = data(b.data_realizada) ?? out.data_prevista
  }
  if (
    typeof out.recorrencia_fim === 'string' &&
    typeof out.data_prevista === 'string' &&
    out.recorrencia_fim < out.data_prevista
  )
    return 'A recorrência não pode terminar antes de começar.'
  return out
}

export function lerInvestimento(b: Record<string, unknown>, novo: boolean) {
  const out: Record<string, unknown> = {}
  if (novo || 'nome' in b) {
    const n = texto(b.nome, 120)
    if (!n) return 'Dê um nome ao investimento.'
    out.nome = n
  }
  if (novo || 'canal' in b) {
    const c = texto(b.canal, 20) || 'meta'
    if (!CANAIS.some((x) => x.valor === c)) return 'Canal inválido.'
    out.canal = c
  }
  if ('utm_campaign' in b) out.utm_campaign = texto(b.utm_campaign, 120) || null
  if ('inicio' in b) out.inicio = data(b.inicio)
  if ('fim' in b) out.fim = data(b.fim)
  if ('orcamento' in b) out.orcamento = b.orcamento === '' || b.orcamento == null ? 0 : (valor(b.orcamento) ?? 0)
  if ('status' in b) {
    if (!['planejado', 'ativo', 'pausado', 'encerrado'].includes(b.status as string)) return 'Status inválido.'
    out.status = b.status
  }
  if ('observacao' in b) out.observacao = texto(b.observacao, 1000) || null
  return out
}

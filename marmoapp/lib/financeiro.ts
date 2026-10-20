// Tipos e rótulos compartilhados do módulo Financeiro (contas a receber /
// contas a pagar). Tabelas: financeiro_lancamentos, financeiro_recorrencias
// — ver supabase/migrations/20261020001_financeiro.sql.

export type TipoLancamento = 'receber' | 'pagar'
export type StatusLancamento = 'previsto' | 'pago' | 'cancelado'
export type OrigemLancamento =
  | 'manual' | 'orcamento' | 'insumo_pedido' | 'funcionario_pagamento' | 'recorrencia' | 'compra_programada'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  categoria: string
  descricao: string
  contraparte: string | null
  valor: number
  vencimento: string
  status: StatusLancamento
  data_pagamento: string | null
  forma_pagamento: string | null
  observacao: string | null
  origem: OrigemLancamento
  orcamento_id: string | null
  insumo_pedido_id: string | null
  funcionario_pagamento_id: string | null
  recorrencia_id: string | null
  acompanha_instalacao: boolean
  parcela_num: number | null
  parcela_total: number | null
  sugestao_chave: string | null
  orcamentos?: { numero: number | null; titulo: string | null } | null
}

export interface Recorrencia {
  id: string
  descricao: string
  contraparte: string | null
  categoria: string
  valor: number
  dia_vencimento: number
  inicio: string
  fim: string | null
  ativo: boolean
}

export const CATEGORIAS_RECEBER: Record<string, string> = {
  venda: 'Venda (pedido)',
  servico_avulso: 'Serviço avulso',
  outros: 'Outras entradas',
}

export const CATEGORIAS_PAGAR: Record<string, string> = {
  material: 'Material (chapas)',
  insumos: 'Insumos',
  equipe: 'Equipe',
  despesa_fixa: 'Despesa fixa',
  impostos: 'Impostos',
  frete: 'Frete',
  manutencao: 'Manutenção',
  outros: 'Outras saídas',
}

export const ORIGEM_LABEL: Record<OrigemLancamento, string> = {
  manual: 'Manual',
  orcamento: 'Pedido',
  insumo_pedido: 'Pedido de insumos',
  funcionario_pagamento: 'Pagamento de equipe',
  recorrencia: 'Despesa fixa',
  compra_programada: 'Compra programada',
}

export const FORMAS_PAGAMENTO = ['Pix', 'Dinheiro', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Cheque']

/** Data local (fuso do navegador/servidor) em YYYY-MM-DD. */
export function hojeISO(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function addDiasISO(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Situação exibida: pago / cancelado / vencido / vence hoje / a vencer. */
export function situacao(l: Pick<Lancamento, 'status' | 'vencimento'>, hoje = hojeISO()) {
  if (l.status === 'pago') return 'pago'
  if (l.status === 'cancelado') return 'cancelado'
  if (l.vencimento < hoje) return 'vencido'
  if (l.vencimento === hoje) return 'hoje'
  return 'aberto'
}

/** Divide um total em entrada (%) + saldo, arredondando o saldo pra fechar o total exato. */
export function dividirEntradaSaldo(total: number, pctEntrada: number) {
  const entrada = Math.round(total * pctEntrada) / 100
  const saldo = Math.round((total - entrada) * 100) / 100
  return { entrada, saldo }
}

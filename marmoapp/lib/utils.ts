import type { Orcamento, OrcamentoItem } from './types'

// Wrapper seguro para operações Supabase: timeout de 12s + garante setLoading(false) via finally
type SbResult = { data: any; error: any }
export async function sbSave(
  operation: PromiseLike<SbResult>,
  timeoutMs = 12000
): Promise<SbResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.')),
      timeoutMs
    )
  )
  return Promise.race([operation as Promise<SbResult>, timeout])
}

export function fmt(v: number | string | undefined | null): string {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function orcTotal(o: Orcamento): number {
  const itens = o.itens || []
  const sub = itens.reduce((s, i) => s + (parseFloat(String(i.total ?? i.total_item ?? 0)) || 0), 0)
  return sub + (parseFloat(String(o.maoObra ?? o.mao_obra ?? 0)) || 0)
       - (parseFloat(String(o.desconto ?? o.desconto_rs ?? 0)) || 0)
}

export function formatPhone(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3')
  else v = v.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3')
  return v
}

export function formatCEP(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{5})(\d)/, '$1-$2')
  return v
}

export function formatCNPJ(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 14)
  v = v.replace(/(\d{2})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1/$2')
  v = v.replace(/(\d{4})(\d)/, '$1-$2')
  return v
}

export async function fetchCEP(cep: string): Promise<{ logradouro?: string; localidade?: string; uf?: string } | null> {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    const d = await r.json()
    if (d.erro) return null
    return d
  } catch {
    return null
  }
}

export const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  recusado: 'Recusado', expired: 'Expirado',
  novo: 'Novo', visualizado: 'Visualizado',
  em_negociacao: 'Em Negociação', fechado: 'Fechado', perdido: 'Perdido',
}

export const PRODUCAO_LABELS: Record<string, string> = {
  comercial: 'Comercial', aguardando_material: 'Aguardando Material',
  em_producao: 'Em Produção', acabamento: 'Acabamento',
  pronto: 'Pronto', entregue: 'Entregue',
}

export const PLANOS = {
  basic:      { nome: 'Plano Basic',      preco: 'R$ 147/mês', price_id: 'price_1TRoPv1opvb2dbnSbv8JBAV0' },
  pro:        { nome: 'Plano Pro',        preco: 'R$ 297/mês', price_id: 'price_1TRoSs1opvb2dbnS8g0agPvL' },
  enterprise: { nome: 'Plano Enterprise', preco: 'R$ 497/mês', price_id: 'price_1TRoTB1opvb2dbnS57zLUfQT' },
}

// === PCP (Controle de Produção) ===
// Mede automaticamente, a partir dos próprios itens já lançados no orçamento,
// quanto foi processado quando um pedido sai de uma etapa. Usa a mesma
// convenção de dimensões do restante do app: frente/fundo = largura,
// esquerda/direita = altura.

// m² de pedra cortada — soma da área de cada item (já calculada na criação do orçamento)
export function areaCortadaItens(itens: Pick<OrcamentoItem, 'area' | 'quantidade'>[]): number {
  return itens.reduce((s, i) => s + ((i.area || 0) * (i.quantidade || 1)), 0)
}

// metros lineares de acabamento — soma o comprimento de cada lado que tem um
// tipo de acabamento marcado (aproximação: não soma saia/frontão extras)
export function mlAcabamentoItens(itens: Pick<OrcamentoItem,
  'largura' | 'altura' | 'quantidade' | 'acabamento_esquerda' | 'acabamento_direita' | 'acabamento_frente' | 'acabamento_fundo'
>[]): number {
  return itens.reduce((s, i) => {
    let ml = 0
    if (i.acabamento_frente) ml += i.largura || 0
    if (i.acabamento_fundo) ml += i.largura || 0
    if (i.acabamento_esquerda) ml += i.altura || 0
    if (i.acabamento_direita) ml += i.altura || 0
    return s + ml * (i.quantidade || 1)
  }, 0)
}

// Capacidade diária média: soma tudo, divide pelos DIAS DISTINTOS com
// apontamento (não pelo total de dias do período) — não dilui a média em
// dias sem nenhuma produção registrada.
export function mediaDiariaPCP(registros: { quantidade: number; data: string }[]): number {
  if (registros.length === 0) return 0
  const porDia: Record<string, number> = {}
  for (const r of registros) porDia[r.data] = (porDia[r.data] || 0) + r.quantidade
  const dias = Object.keys(porDia)
  const total = Object.values(porDia).reduce((s, v) => s + v, 0)
  return dias.length > 0 ? total / dias.length : 0
}

// Taxa média de custo (R$/m² ou R$/ml, conforme o cargo) entre os
// funcionários ativos desse cargo que já têm a taxa cadastrada. Usada pra
// estimar o custo real de mão de obra de um orçamento ainda não fechado
// (sem saber ainda quem exatamente vai executar o serviço).
export function taxaMediaPorCargo(
  funcionarios: { cargo: string; ativo: boolean; valor_metro_linear?: number | null }[],
  cargo: string
): number {
  const comTaxa = funcionarios.filter(f => f.ativo && f.cargo === cargo && (f.valor_metro_linear || 0) > 0)
  if (comTaxa.length === 0) return 0
  return comTaxa.reduce((s, f) => s + (f.valor_metro_linear || 0), 0) / comTaxa.length
}

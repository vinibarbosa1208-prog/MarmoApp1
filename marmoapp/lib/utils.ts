import type { Orcamento } from './types'

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

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  expandir,
  hojeBR,
  somarDias,
  type Investimento,
  type Lancamento,
  type TipoCliente,
} from '@/lib/financeiro'

export const COLUNAS_LANCAMENTO =
  'id, tipo, categoria, descricao, valor, data_prevista, recorrencia, recorrencia_fim, status, data_realizada, origem_id, marmoraria_id, investimento_id, observacao'

export async function carregarLancamentos(filtro?: { marmoraria_id?: string }): Promise<Lancamento[]> {
  let q = supabaseAdmin.from('admin_fin_lancamentos').select(COLUNAS_LANCAMENTO).order('data_prevista')
  if (filtro?.marmoraria_id) q = q.eq('marmoraria_id', filtro.marmoraria_id)
  const { data, error } = await q.limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []).map((l) => ({ ...l, valor: Number(l.valor) })) as Lancamento[]
}

/** Classificação de cada marmoraria (sem linha = 'cadastro'). */
export async function carregarClassificacoes(): Promise<Record<string, TipoCliente>> {
  const { data, error } = await supabaseAdmin.from('admin_clientes').select('marmoraria_id, tipo')
  if (error) throw new Error(error.message)
  const out: Record<string, TipoCliente> = {}
  for (const r of data ?? []) out[r.marmoraria_id as string] = r.tipo as TipoCliente
  return out
}

/** IDs das contas de teste e internas, que ficam fora de todos os números. */
export function idsForaDosNumeros(c: Record<string, TipoCliente>) {
  return new Set(Object.entries(c).filter(([, t]) => t === 'teste' || t === 'interno').map(([id]) => id))
}

export interface RetornoInvestimento extends Investimento {
  investido: number
  a_investir: number
  leads: number
  diagnosticos: number
  contratos: number
  receita_recebida: number
  receita_contratada_12m: number
  custo_por_lead: number | null
  cac: number | null
  roi: number | null
}

/**
 * Investimentos de marketing com o que já se gastou (saídas realizadas ligadas a ele),
 * os leads da campanha (leads.utm_campaign = utm_campaign) e o que virou contrato.
 */
export async function carregarInvestimentosComRetorno(lancamentos: Lancamento[]): Promise<RetornoInvestimento[]> {
  const { data: invs, error } = await supabaseAdmin
    .from('admin_fin_investimentos')
    .select('id, nome, canal, utm_campaign, inicio, fim, orcamento, status, observacao')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!invs?.length) return []

  const hoje = hojeBR()
  const ocorrencias = expandir(lancamentos, '2025-01-01', somarDias(hoje, 400), hoje)

  const utms = invs.map((i) => (i.utm_campaign ?? '').trim()).filter(Boolean)
  const leadsPorUtm: Record<string, string[]> = {}
  if (utms.length) {
    const { data: leads } = await supabaseAdmin.from('leads').select('id, utm_campaign').in('utm_campaign', utms)
    for (const l of leads ?? []) (leadsPorUtm[l.utm_campaign as string] ??= []).push(l.id as string)
  }
  const todosLeads = Object.values(leadsPorUtm).flat()
  const diagPorLead: Record<string, number> = {}
  const contratosPorLead: Record<string, { n: number; v12: number }> = {}
  if (todosLeads.length) {
    const [d, c] = await Promise.all([
      supabaseAdmin.from('diagnosticos').select('lead_id').in('lead_id', todosLeads),
      supabaseAdmin
        .from('contratos')
        .select('lead_id, mensalidade, implantacao')
        .eq('status', 'assinado')
        .in('lead_id', todosLeads),
    ])
    for (const r of d.data ?? []) diagPorLead[r.lead_id as string] = (diagPorLead[r.lead_id as string] ?? 0) + 1
    for (const r of c.data ?? []) {
      const k = r.lead_id as string
      const atual = (contratosPorLead[k] ??= { n: 0, v12: 0 })
      atual.n++
      atual.v12 += Number(r.mensalidade ?? 0) * 12 + Number(r.implantacao ?? 0)
    }
  }

  return invs.map((i) => {
    const minhas = ocorrencias.filter((o) => o.investimento_id === i.id)
    const investido = minhas.filter((o) => o.tipo === 'saida' && o.status === 'realizado').reduce((s, o) => s + o.valor, 0)
    const aInvestir = minhas
      .filter((o) => o.tipo === 'saida' && (o.status === 'previsto' || o.status === 'atrasado'))
      .reduce((s, o) => s + o.valor, 0)
    const recebida = minhas.filter((o) => o.tipo === 'entrada' && o.status === 'realizado').reduce((s, o) => s + o.valor, 0)
    const leadIds = leadsPorUtm[(i.utm_campaign ?? '').trim()] ?? []
    const diagnosticos = leadIds.reduce((s, id) => s + (diagPorLead[id] ?? 0), 0)
    const contratos = leadIds.reduce((s, id) => s + (contratosPorLead[id]?.n ?? 0), 0)
    const v12 = leadIds.reduce((s, id) => s + (contratosPorLead[id]?.v12 ?? 0), 0)
    const retorno = Math.max(v12, recebida)
    return {
      ...(i as Investimento),
      orcamento: Number(i.orcamento),
      investido,
      a_investir: aInvestir,
      leads: leadIds.length,
      diagnosticos,
      contratos,
      receita_recebida: recebida,
      receita_contratada_12m: v12,
      custo_por_lead: investido > 0 && leadIds.length ? investido / leadIds.length : null,
      cac: investido > 0 && contratos ? investido / contratos : null,
      roi: investido > 0 ? (retorno - investido) / investido : null,
    }
  })
}

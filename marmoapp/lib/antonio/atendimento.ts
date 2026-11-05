import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemPreOrcamento } from './marcadores'

interface MaterialRow { nome: string; categoria: string | null; unidade: string | null; preco_venda: number | null }
interface ServicoRow { nome: string; unidade: string | null; preco_padrao: number | null; ordem: number | null }

export interface CatalogoPublico {
  texto: string
  materiais: MaterialRow[]
  servicos: ServicoRow[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Catálogo só com PREÇOS DE VENDA (sem custo, fornecedor ou clientes), para o atendimento ao cliente final. */
export async function carregarCatalogoPublico(db: SupabaseClient, marmorariaId: string): Promise<CatalogoPublico> {
  const [{ data: mats }, { data: svcs }] = await Promise.all([
    db.from('materiais').select('nome, categoria, unidade, preco_venda').eq('marmoraria_id', marmorariaId).eq('ativo', true),
    db.from('servicos').select('nome, unidade, preco_padrao, ordem').eq('marmoraria_id', marmorariaId).eq('ativo', true).order('ordem'),
  ])

  const materiais = ((mats || []) as MaterialRow[]).filter(m => (m.preco_venda || 0) > 0)
  const servicos = ((svcs || []) as ServicoRow[]).filter(s => (s.preco_padrao || 0) > 0)

  const porCategoria = new Map<string, string[]>()
  for (const m of materiais) {
    const cat = (m.categoria || 'outros').trim() || 'outros'
    const lista = porCategoria.get(cat) || []
    lista.push(`${m.nome} R$ ${brl(m.preco_venda!)}/${m.unidade || 'm²'}`)
    porCategoria.set(cat, lista)
  }
  const blocoMateriais = [...porCategoria.entries()].map(([cat, l]) => `${cat}: ${l.join('; ')}`).join('\n')

  const blocoServicos = servicos
    .map(s => `${s.nome} R$ ${brl(s.preco_padrao!)}/${s.unidade || 'un'} (${(s.ordem ?? 0) < 1000 ? 'fabricação' : 'colocação'})`)
    .join('\n')

  return {
    texto: `PEDRAS (preço de venda):\n${blocoMateriais || '(nenhuma cadastrada)'}\n\nSERVIÇOS:\n${blocoServicos || '(nenhum cadastrado)'}`,
    materiais,
    servicos,
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Recalcula o pré-orçamento com os preços do catálogo (o modelo não define preço)
 * e devolve a faixa arredondada para R$ 50.
 */
export function calcularFaixa(itens: ItemPreOrcamento[], cat: CatalogoPublico, margem = 0.1) {
  const conferidos = itens.map(item => {
    const alvo = norm(item.descricao)
    const lista = item.tipo === 'material'
      ? cat.materiais.map(m => ({ nome: m.nome, preco: m.preco_venda || 0 }))
      : cat.servicos.map(s => ({ nome: s.nome, preco: s.preco_padrao || 0 }))
    const achado = lista.find(x => norm(x.nome) === alvo) || lista.find(x => alvo.includes(norm(x.nome)) || norm(x.nome).includes(alvo))
    return { ...item, preco_unitario: achado ? achado.preco : item.preco_unitario, conferido: !!achado }
  })

  const total = conferidos.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const arred = (n: number) => Math.round(n / 50) * 50
  return {
    itens: conferidos,
    total: Math.round(total * 100) / 100,
    minimo: arred(total * (1 - margem)),
    maximo: arred(total * (1 + margem)),
    todosConferidos: conferidos.every(i => i.conferido),
  }
}

export function textoFaixa(minimo: number, maximo: number): string {
  const f = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  return `*${f(minimo)} a ${f(maximo)}*. É uma estimativa: o valor final sai na medição.`
}

/** Compromissos dos próximos 10 dias, para o Antônio não marcar medição em cima. */
export async function agendaOcupada(db: SupabaseClient, marmorariaId: string): Promise<string> {
  const inicio = new Date()
  const fim = new Date(Date.now() + 10 * 86400_000)
  const { data } = await db
    .from('agenda_events')
    .select('data_inicio, data_fim, dia_inteiro')
    .eq('marmoraria_id', marmorariaId)
    .gte('data_inicio', inicio.toISOString())
    .lte('data_inicio', fim.toISOString())
    .order('data_inicio')

  if (!data?.length) return '(nenhum compromisso registrado)'
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return data
    .map(e => (e.dia_inteiro ? `${fmt(e.data_inicio).split(',')[0]} (dia inteiro)` : `${fmt(e.data_inicio)}${e.data_fim ? ` até ${fmt(e.data_fim).split(' ').pop()}` : ''}`))
    .join('\n')
}

export function agoraBrasilia(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Converte "AAAA-MM-DDTHH:MM" (horário de Brasília) em ISO UTC. */
export function brasiliaParaIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

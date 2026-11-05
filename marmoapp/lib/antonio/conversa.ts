import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentMessage } from './agent'

export type ModoAntonio = 'vendas' | 'atendimento'

export interface Sessao {
  id: string
  marmoraria_id: string
  phone: string
  modo: ModoAntonio
  humano_ate: string | null
  cliente_id: string | null
}

/** Só dígitos, com DDI 55 quando o número vier sem ele. */
export function normalizarTelefone(valor: string | null | undefined): string {
  const d = (valor || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

/** Mesmo número com e sem o 9 extra do celular (o WhatsApp às vezes omite). */
export function variantesTelefone(phone: string): string[] {
  const d = normalizarTelefone(phone)
  const out = new Set([d])
  if (d.startsWith('55') && d.length === 13) out.add(d.slice(0, 4) + d.slice(5))
  if (d.startsWith('55') && d.length === 12) out.add(d.slice(0, 4) + '9' + d.slice(4))
  return [...out]
}

export function telefoneParaJid(phone: string): string {
  return `${normalizarTelefone(phone)}@s.whatsapp.net`
}

export async function obterSessao(
  db: SupabaseClient,
  marmorariaId: string,
  phone: string,
  modo: ModoAntonio,
): Promise<Sessao> {
  const { data: existente } = await db
    .from('antonio_sessions')
    .select('id, marmoraria_id, phone, modo, humano_ate, cliente_id')
    .eq('marmoraria_id', marmorariaId)
    .eq('phone', phone)
    .eq('canal', 'whatsapp')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) return existente as Sessao

  const { data: nova, error } = await db
    .from('antonio_sessions')
    .insert({ marmoraria_id: marmorariaId, phone, canal: 'whatsapp', modo, status: 'ativa' })
    .select('id, marmoraria_id, phone, modo, humano_ate, cliente_id')
    .single()

  if (error || !nova) throw new Error(`Não foi possível criar a sessão: ${error?.message}`)
  return nova as Sessao
}

/** Últimas mensagens da conversa, em ordem cronológica, prontas para o modelo. */
export async function historico(db: SupabaseClient, sessaoId: string, limite = 24): Promise<AgentMessage[]> {
  const { data } = await db
    .from('antonio_messages')
    .select('role, content')
    .eq('session_id', sessaoId)
    .order('created_at', { ascending: false })
    .limit(limite)

  const msgs = (data || []).reverse().filter(m => m.role === 'user' || m.role === 'assistant') as AgentMessage[]

  // A API exige alternância começando pelo usuário: junta mensagens seguidas do mesmo papel.
  const juntas: AgentMessage[] = []
  for (const m of msgs) {
    const ultima = juntas[juntas.length - 1]
    if (ultima && ultima.role === m.role) ultima.content += `\n${m.content}`
    else juntas.push({ role: m.role, content: m.content })
  }
  while (juntas.length && juntas[0].role !== 'user') juntas.shift()
  return juntas
}

export async function registrarMensagem(
  db: SupabaseClient,
  sessaoId: string,
  role: 'user' | 'assistant' | 'humano',
  content: string,
  tokens?: number,
) {
  await db.from('antonio_messages').insert({ session_id: sessaoId, role, content, tokens: tokens ?? null })
  await db.from('antonio_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessaoId)
}

/** Pausa o Antônio nesta conversa (um humano assumiu). */
export async function passarParaHumano(db: SupabaseClient, sessaoId: string, horas = 12) {
  const ate = new Date(Date.now() + horas * 3600_000).toISOString()
  await db.from('antonio_sessions').update({ humano_ate: ate, status: 'humano' }).eq('id', sessaoId)
}

export function humanoAtivo(sessao: Sessao): boolean {
  return !!sessao.humano_ate && new Date(sessao.humano_ate).getTime() > Date.now()
}

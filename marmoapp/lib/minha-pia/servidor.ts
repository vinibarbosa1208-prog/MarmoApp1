// Só servidor (usa crypto do Node e a service key).
import { cookies } from 'next/headers'
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'crypto'
import { promisify } from 'util'
import { apiSupabase as supabase } from '@/lib/api-auth'

const scrypt = promisify(scryptCb) as (senha: string, salt: Buffer, tam: number) => Promise<Buffer>

// Portal do cliente final (Pia Programada). Assim como o portal do
// instalador, ainda atende uma marmoraria só (Real Pedras). Quando outras
// marmorarias entrarem, troque por resolução de tenant (ex.: slug na URL).
export function getProgramadoMarmorariaId(): string {
  return process.env.PROGRAMADO_MARMORARIA_ID || 'a7f52e2a-bca6-4270-a35c-99e7988b067d'
}

export const COOKIE_SESSAO = 'mp_sessao'
const DURACAO_SESSAO_DIAS = 60
export const MAX_TENTATIVAS_PIN = 5
export const BLOQUEIO_PIN_MIN = 15

// ── PIN ──────────────────────────────────────────────────────────────
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const h = await scrypt(pin, salt, 32)
  return `s1$${salt.toString('hex')}$${h.toString('hex')}`
}

export async function conferePin(pin: string, armazenado: string): Promise<boolean> {
  const [v, saltHex, hHex] = armazenado.split('$')
  if (v !== 's1' || !saltHex || !hHex) return false
  const h = await scrypt(pin, Buffer.from(saltHex, 'hex'), 32)
  const esperado = Buffer.from(hHex, 'hex')
  return esperado.length === h.length && timingSafeEqual(esperado, h)
}

export function pinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin) && !/^(\d)\1{3}$/.test(pin) && pin !== '1234'
}

// ── Sessão ───────────────────────────────────────────────────────────
function hashToken(t: string) {
  return createHash('sha256').update(t).digest('hex')
}

export async function abrirSessao(adesaoId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + DURACAO_SESSAO_DIAS * 86400_000)
  const { error } = await supabase.from('programado_sessoes').insert({
    token_hash: hashToken(token), adesao_id: adesaoId, expira_em: expira.toISOString(),
  })
  if (error) throw error
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', expires: expira,
  })
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_SESSAO)?.value
  if (token) await supabase.from('programado_sessoes').delete().eq('token_hash', hashToken(token))
  jar.delete(COOKIE_SESSAO)
}

// Devolve o id da adesão logada (ou null). Sempre confere a marmoraria.
export async function adesaoDaSessao(): Promise<string | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_SESSAO)?.value
  if (!token) return null
  const { data } = await supabase
    .from('programado_sessoes')
    .select('adesao_id, expira_em, programado_adesoes!inner(marmoraria_id)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!data || new Date(data.expira_em) < new Date()) return null
  const adesao = data.programado_adesoes as unknown as { marmoraria_id: string }
  if (adesao.marmoraria_id !== getProgramadoMarmorariaId()) return null
  return data.adesao_id
}

// ── Config ───────────────────────────────────────────────────────────
export interface ConfigProgramado {
  ativo: boolean
  nome_programa: string
  prazo_entrega_dias: number
  cidades_atendidas: string[]
  parcelas_opcoes: number[]
  whatsapp_contato: string | null
  pix_chave: string | null
  pix_favorecido: string | null
}

export async function carregarConfig(marmoraria_id: string): Promise<ConfigProgramado> {
  const { data } = await supabase
    .from('programado_config')
    .select('ativo, nome_programa, prazo_entrega_dias, cidades_atendidas, parcelas_opcoes, whatsapp_contato, pix_chave, pix_favorecido')
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()
  return {
    ativo: data?.ativo ?? false,
    nome_programa: data?.nome_programa ?? 'Pia Programada',
    prazo_entrega_dias: data?.prazo_entrega_dias ?? 20,
    cidades_atendidas: data?.cidades_atendidas ?? [],
    parcelas_opcoes: (data?.parcelas_opcoes ?? [150, 200, 250, 300]).map(Number),
    whatsapp_contato: data?.whatsapp_contato ?? null,
    pix_chave: data?.pix_chave ?? null,
    pix_favorecido: data?.pix_favorecido ?? null,
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

// Publicação no Instagram pela API oficial (Instagram Graph API, conta profissional
// ligada à Página do Facebook do MarmoApp).
// Precisa de IG_PUBLISH_TOKEN: token de usuário do sistema com instagram_basic,
// instagram_content_publish, pages_show_list e pages_read_engagement.
// A conta do Instagram é descoberta pela Página (IG_PAGE_ID) ou vem direto em IG_USER_ID.
import { supabaseAdmin } from '@/lib/supabase-admin'

const VERSAO = process.env.META_API_VERSION || 'v26.0'
const PAGINA_PADRAO = '709890622215346' // Página do Facebook "MarmoApp"

function limparToken(bruto: string | undefined) {
  if (!bruto) return undefined
  let t = bruto.replace(/\s+/g, '')
  t = t.replace(/^["'`]+|["'`]+$/g, '')
  t = t.replace(/^Bearer/i, '').replace(/^access_token=/i, '')
  return t || undefined
}

export function configInstagram() {
  const token = limparToken(process.env.IG_PUBLISH_TOKEN)
  return {
    token,
    pagina: process.env.IG_PAGE_ID?.trim() || PAGINA_PADRAO,
    igUser: process.env.IG_USER_ID?.trim() || null,
    pronto: !!token && token.startsWith('EAA') && token.length > 100,
  }
}

export type PostIG = {
  id: string
  tipo: 'reels' | 'story' | 'imagem'
  titulo: string
  midia_url: string
  capa_url: string | null
  legenda: string
  publicar_em: string
  status: 'rascunho' | 'aprovado' | 'publicando' | 'publicado' | 'erro' | 'cancelado'
  container_id: string | null
  ig_media_id: string | null
  permalink: string | null
  erro: string | null
  tentativas: number
}

async function chamar(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>, token: string) {
  const url = `https://graph.facebook.com/${VERSAO}/${caminho}`
  const corpo = new URLSearchParams(params)
  // O token vai no cabeçalho, nunca na URL (não aparece em logs).
  const r = await fetch(metodo === 'GET' ? `${url}?${corpo}` : url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(metodo === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: metodo === 'POST' ? corpo : undefined,
    cache: 'no-store',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) {
    const e = j.error ?? {}
    throw new Error(`Instagram ${r.status}: ${e.error_user_msg ?? e.message ?? 'erro desconhecido'}${e.code ? ` (código ${e.code})` : ''}`)
  }
  return j as Record<string, unknown>
}

let cacheConta: { id: string; username: string } | null = null

/** Conta do Instagram ligada à Página do MarmoApp. */
export async function contaInstagram() {
  const { token, pagina, igUser, pronto } = configInstagram()
  if (!pronto || !token) throw new Error('Instagram não configurado: falta IG_PUBLISH_TOKEN na Vercel.')
  if (cacheConta) return cacheConta
  let id = igUser
  if (!id) {
    const p = await chamar('GET', pagina, { fields: 'instagram_business_account' }, token)
    id = (p.instagram_business_account as { id?: string } | undefined)?.id ?? null
    if (!id) throw new Error('A Página do Facebook do MarmoApp não está ligada a uma conta profissional do Instagram.')
  }
  const c = await chamar('GET', id, { fields: 'username' }, token)
  cacheConta = { id, username: String(c.username ?? '') }
  return cacheConta
}

async function atualizar(id: string, mud: Partial<PostIG> & Record<string, unknown>) {
  await supabaseAdmin
    .from('admin_ig_posts')
    .update({ ...mud, updated_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Anda um passo com cada post aprovado que já passou da hora:
 * 1) cria o contêiner (o Instagram baixa o vídeo da URL); 2) quando ele fica pronto, publica.
 * Vídeos levam de 30 s a alguns minutos para processar, por isso é em passos, a cada execução.
 */
export async function processarFila(agora = new Date()) {
  const { token } = configInstagram()
  const conta = await contaInstagram()
  if (!token) throw new Error('sem token')

  const { data } = await supabaseAdmin
    .from('admin_ig_posts')
    .select('*')
    .in('status', ['aprovado', 'publicando'])
    .lte('publicar_em', agora.toISOString())
    .order('publicar_em')
    .limit(5)
  const resultado: { id: string; titulo: string; passo: string }[] = []

  for (const p of (data ?? []) as PostIG[]) {
    try {
      if (p.status === 'aprovado' || !p.container_id) {
        const params: Record<string, string> = {}
        if (p.tipo === 'reels') {
          Object.assign(params, { media_type: 'REELS', video_url: p.midia_url, caption: p.legenda, share_to_feed: 'true' })
          if (p.capa_url) params.cover_url = p.capa_url
        } else if (p.tipo === 'story') {
          const video = /\.(mp4|mov)(\?|$)/i.test(p.midia_url)
          Object.assign(params, { media_type: 'STORIES', [video ? 'video_url' : 'image_url']: p.midia_url })
        } else {
          Object.assign(params, { image_url: p.midia_url, caption: p.legenda })
        }
        const c = await chamar('POST', `${conta.id}/media`, params, token)
        await atualizar(p.id, { status: 'publicando', container_id: String(c.id), erro: null, tentativas: p.tentativas + 1 })
        resultado.push({ id: p.id, titulo: p.titulo, passo: 'contêiner criado' })
        continue
      }

      const s = await chamar('GET', p.container_id, { fields: 'status_code,status' }, token)
      const codigo = String(s.status_code ?? '')
      if (codigo === 'IN_PROGRESS') {
        resultado.push({ id: p.id, titulo: p.titulo, passo: 'processando' })
        continue
      }
      if (codigo === 'ERROR' || codigo === 'EXPIRED') {
        await atualizar(p.id, { status: 'erro', erro: `O Instagram recusou a mídia (${codigo}): ${String(s.status ?? '')}`, container_id: null })
        resultado.push({ id: p.id, titulo: p.titulo, passo: 'erro' })
        continue
      }
      const pub = await chamar('POST', `${conta.id}/media_publish`, { creation_id: p.container_id }, token)
      const mediaId = String(pub.id)
      let permalink: string | null = null
      try {
        permalink = String((await chamar('GET', mediaId, { fields: 'permalink' }, token)).permalink ?? '') || null
      } catch {
        permalink = null
      }
      await atualizar(p.id, { status: 'publicado', ig_media_id: mediaId, permalink, publicado_em: new Date().toISOString(), erro: null })
      resultado.push({ id: p.id, titulo: p.titulo, passo: 'publicado' })
    } catch (e) {
      const msg = (e as Error).message.slice(0, 500)
      // Três tentativas antes de desistir; depois fica em "erro" para alguém olhar.
      const desiste = p.tentativas + 1 >= 3
      await atualizar(p.id, {
        status: desiste ? 'erro' : 'aprovado',
        container_id: null,
        erro: msg,
        tentativas: p.tentativas + 1,
      })
      resultado.push({ id: p.id, titulo: p.titulo, passo: `falhou: ${msg}` })
    }
  }
  return { conta: conta.username, processados: resultado }
}

/** Início da janela da fila (30 dias atrás) e o instante de agora, fora dos componentes. */
export function janelaFila() {
  const agora = new Date()
  return { desde: new Date(agora.getTime() - 30 * 86400000).toISOString(), agora: agora.toISOString() }
}

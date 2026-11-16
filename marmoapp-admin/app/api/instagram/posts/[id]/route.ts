import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Ações sobre um post: { acao: 'aprovar' | 'rascunho' | 'cancelar' | 'agora' }
 * ou edição: { legenda?, publicar_em? } (só antes de publicar).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const { data: p } = await supabaseAdmin.from('admin_ig_posts').select('status').eq('id', id).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (p.status === 'publicado' || p.status === 'publicando')
    return NextResponse.json({ error: 'Este post já está sendo publicado ou já saiu.' }, { status: 409 })

  const b = await request.json().catch(() => ({}))
  const agora = new Date().toISOString()
  let mud: Record<string, unknown> = {}
  if (b.acao === 'aprovar') mud = { status: 'aprovado', aprovado_em: agora, aprovado_por: user.email, erro: null, tentativas: 0 }
  else if (b.acao === 'rascunho') mud = { status: 'rascunho', aprovado_em: null, aprovado_por: null }
  else if (b.acao === 'cancelar') mud = { status: 'cancelado' }
  else if (b.acao === 'agora') mud = { status: 'aprovado', publicar_em: agora, aprovado_em: agora, aprovado_por: user.email, erro: null, tentativas: 0 }
  else {
    if (typeof b.legenda === 'string') mud.legenda = b.legenda.slice(0, 2200)
    if (typeof b.publicar_em === 'string') {
      const d = new Date(b.publicar_em)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Data e hora inválidas.' }, { status: 400 })
      mud.publicar_em = d.toISOString()
    }
    if (!Object.keys(mud).length) return NextResponse.json({ error: 'Nada para mudar.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('admin_ig_posts').update({ ...mud, updated_at: agora }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

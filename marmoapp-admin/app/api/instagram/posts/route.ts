import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { janelaFila } from '@/lib/instagram'

// Fila de posts do Instagram: lista e criação.
export async function GET() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { desde } = janelaFila()
  const { data, error } = await supabaseAdmin.from('admin_ig_posts').select('*').gte('publicar_em', desde).order('publicar_em')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const tipo = ['reels', 'story', 'imagem'].includes(b.tipo) ? b.tipo : 'reels'
  const titulo = typeof b.titulo === 'string' ? b.titulo.trim().slice(0, 140) : ''
  const midia = typeof b.midia_url === 'string' ? b.midia_url.trim() : ''
  const quando = typeof b.publicar_em === 'string' ? new Date(b.publicar_em) : null
  if (!titulo) return NextResponse.json({ error: 'Dê um título ao post.' }, { status: 400 })
  if (!/^https:\/\//.test(midia)) return NextResponse.json({ error: 'A mídia precisa de um link público https.' }, { status: 400 })
  if (!quando || Number.isNaN(quando.getTime())) return NextResponse.json({ error: 'Data e hora inválidas.' }, { status: 400 })
  const legenda = typeof b.legenda === 'string' ? b.legenda.slice(0, 2200) : ''
  const { data, error } = await supabaseAdmin
    .from('admin_ig_posts')
    .insert({ tipo, titulo, midia_url: midia, capa_url: b.capa_url || null, legenda, publicar_em: quando.toISOString() })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

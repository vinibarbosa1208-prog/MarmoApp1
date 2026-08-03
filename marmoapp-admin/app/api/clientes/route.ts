import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import type { Marmoraria, Orcamento, Usuario } from '@/lib/types'

export async function GET(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const busca = searchParams.get('busca')
  const plano = searchParams.get('plano')

  let query = supabaseAdmin.from('marmorarias').select('*').order('created_at', { ascending: false })

  if (plano) query = query.eq('plano', plano)
  if (busca) query = query.ilike('nome', `%${busca}%`)

  const { data: marmorarias, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (marmorarias ?? []).map((m: Marmoraria) => m.id)
  if (ids.length === 0) return NextResponse.json({ clientes: [] })

  const [usuariosRes, orcamentosRes] = await Promise.all([
    supabaseAdmin.from('usuarios').select('marmoraria_id').in('marmoraria_id', ids),
    supabaseAdmin
      .from('orcamentos')
      .select('marmoraria_id, created_at')
      .in('marmoraria_id', ids)
      .order('created_at', { ascending: false }),
  ])

  const usuariosByMarmoraria: Record<string, number> = {}
  for (const u of (usuariosRes.data ?? []) as Usuario[]) {
    usuariosByMarmoraria[u.marmoraria_id] = (usuariosByMarmoraria[u.marmoraria_id] ?? 0) + 1
  }

  const orcamentosByMarmoraria: Record<string, { count: number; ultimo: string | null }> = {}
  for (const o of (orcamentosRes.data ?? []) as Orcamento[]) {
    if (!orcamentosByMarmoraria[o.marmoraria_id]) {
      orcamentosByMarmoraria[o.marmoraria_id] = { count: 0, ultimo: o.created_at }
    }
    orcamentosByMarmoraria[o.marmoraria_id].count++
  }

  const clientes = (marmorarias ?? []).map((m: Marmoraria) => ({
    ...m,
    usuarios_count: usuariosByMarmoraria[m.id] ?? 0,
    orcamentos_count: orcamentosByMarmoraria[m.id]?.count ?? 0,
    ultimo_orcamento: orcamentosByMarmoraria[m.id]?.ultimo ?? null,
  }))

  return NextResponse.json({ clientes })
}

export async function POST(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { nome, plano } = body as { nome?: string; plano?: string; email?: string }

  if (!nome || !plano) {
    return NextResponse.json({ error: 'nome e plano são obrigatórios' }, { status: 400 })
  }

  const trialExpira =
    plano === 'trial'
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null

  const { data, error } = await supabaseAdmin
    .from('marmorarias')
    .insert({ nome, plano, trial_expira: trialExpira, setup_concluido: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ marmoraria: data }, { status: 201 })
}

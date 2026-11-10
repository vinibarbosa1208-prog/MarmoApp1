import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { carregarLancamentos, COLUNAS_LANCAMENTO } from '@/lib/financeiro-servidor'
import { lerLancamento } from '@/lib/financeiro-validacao'

// Lançamentos do financeiro interno: lista e criação.

export async function GET(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const m = new URL(request.url).searchParams.get('marmoraria')
  try {
    const lancamentos = await carregarLancamentos(m && /^[0-9a-f-]{36}$/i.test(m) ? { marmoraria_id: m } : undefined)
    return NextResponse.json({ lancamentos })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const l = lerLancamento(b, true)
  if (typeof l === 'string') return NextResponse.json({ error: l }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('admin_fin_lancamentos')
    .insert({ ...l, criado_por: user.email })
    .select(COLUNAS_LANCAMENTO)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lancamento: data }, { status: 201 })
}

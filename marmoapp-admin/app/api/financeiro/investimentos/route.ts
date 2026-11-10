import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { carregarInvestimentosComRetorno, carregarLancamentos } from '@/lib/financeiro-servidor'
import { lerInvestimento } from '@/lib/financeiro-validacao'

// Investimentos de marketing: lista (com retorno) e criação.

export async function GET() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const investimentos = await carregarInvestimentosComRetorno(await carregarLancamentos())
    return NextResponse.json({ investimentos })
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
  const inv = lerInvestimento(b, true)
  if (typeof inv === 'string') return NextResponse.json({ error: inv }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('admin_fin_investimentos').insert(inv).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

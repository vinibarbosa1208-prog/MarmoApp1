import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { atualizarGastoNoFinanceiro } from '@/lib/meta'

type Ctx = { params: Promise<{ id: string }> }

// Liga (ou desliga) uma campanha do Meta a um investimento do Financeiro.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Campanha inválida' }, { status: 400 })
  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const inv = b.investimento_id
  if (inv !== null && (typeof inv !== 'string' || !/^[0-9a-f-]{36}$/i.test(inv)))
    return NextResponse.json({ error: 'Investimento inválido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('admin_meta_campanhas').update({ investimento_id: inv }).eq('campaign_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Ao desligar, os lançamentos já criados ficam no Financeiro (só deixam de ser atualizados).
  if (inv) await atualizarGastoNoFinanceiro()
  return NextResponse.json({ ok: true })
}

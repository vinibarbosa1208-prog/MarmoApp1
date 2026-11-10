import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { VERSAO_MODELO } from '@/lib/contrato/modelo'
import { colunasDoContrato, contratadaPadrao, lerContratante, lerEntrada } from '@/lib/contrato/servidor'

// Contratos da MarmorarIA: lista e criação de rascunho.

export async function GET() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('contratos')
    .select('id, numero, status, plano, condicao, mensalidade, primeira_cobranca, contratante, enviado_em, assinado_em, link_pagamento, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contratos: data ?? [] })
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

  const entrada = lerEntrada(b)
  if (typeof entrada === 'string') return NextResponse.json({ error: entrada }, { status: 400 })
  const contratante = lerContratante(b.contratante)
  if (!contratante.razao_social) return NextResponse.json({ error: 'Informe a razão social da marmoraria.' }, { status: 400 })

  const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)

  const { data, error } = await supabaseAdmin
    .from('contratos')
    .insert({
      ...colunasDoContrato(entrada, contratante),
      lead_id: uuid(b.lead_id),
      diagnostico_id: uuid(b.diagnostico_id),
      contratada: contratadaPadrao(),
      versao_modelo: VERSAO_MODELO,
      status: 'rascunho',
      criado_por: user.email ?? null,
    })
    .select('id, numero')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

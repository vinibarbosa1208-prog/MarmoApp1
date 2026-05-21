import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    const { data: pedido, error: errPed } = await supabase
      .from('insumo_pedidos')
      .select('id, status')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (errPed || !pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    if (pedido.status !== 'recebido') return NextResponse.json({ error: 'Apenas pedidos recebidos podem ser marcados como pagos' }, { status: 400 })

    const hoje = new Date().toISOString().split('T')[0]

    const { error: errUp } = await supabase
      .from('insumo_pedidos')
      .update({ status: 'pago', data_pagamento: hoje })
      .eq('id', id)

    if (errUp) throw errUp

    return NextResponse.json({ ok: true, data_pagamento: hoje })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

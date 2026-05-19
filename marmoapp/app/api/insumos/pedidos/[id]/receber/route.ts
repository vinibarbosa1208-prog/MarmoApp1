import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    // Verifica que o pedido existe e pertence a esta marmoraria
    const { data: pedido, error: errPed } = await supabase
      .from('insumo_pedidos')
      .select('id, status, insumo_pedido_itens(insumo_id, quantidade)')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (errPed || !pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    if (pedido.status === 'recebido') return NextResponse.json({ error: 'Pedido já recebido' }, { status: 400 })

    const hoje = new Date().toISOString().split('T')[0]

    // Marca pedido como recebido
    const { error: errUp } = await supabase
      .from('insumo_pedidos')
      .update({ status: 'recebido', data_recebimento: hoje })
      .eq('id', id)

    if (errUp) throw errUp

    // Soma ao estoque de cada insumo do pedido
    const itens: { insumo_id: string; quantidade: number }[] = pedido.insumo_pedido_itens || []

    await Promise.all(
      itens.map(async (item) => {
        const { data: insumo } = await supabase
          .from('insumos')
          .select('estoque_atual')
          .eq('id', item.insumo_id)
          .single()

        if (!insumo) return
        const novoEstoque = Number(insumo.estoque_atual) + Number(item.quantidade)
        await supabase
          .from('insumos')
          .update({ estoque_atual: novoEstoque })
          .eq('id', item.insumo_id)
      })
    )

    return NextResponse.json({ ok: true, data_recebimento: hoje })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

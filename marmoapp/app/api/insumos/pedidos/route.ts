import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('insumo_pedidos')
      .select('*, fornecedoras(nome), insumo_pedido_itens(*, insumos(nome, unidade))')
      .eq('marmoraria_id', marmoraria_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const itens: { insumo_id: string; quantidade: number; preco_unitario?: number }[] = body.itens || []
    if (!itens.length) return NextResponse.json({ error: 'Pelo menos um item obrigatório' }, { status: 400 })

    // Cria o pedido
    const { data: pedido, error: errPed } = await supabase
      .from('insumo_pedidos')
      .insert({
        marmoraria_id,
        fornecedora_id: body.fornecedora_id || null,
        numero_pedido: body.numero_pedido || null,
        data_pedido: body.data_pedido || new Date().toISOString().split('T')[0],
        observacoes: body.observacoes || null,
        status: 'pendente',
      })
      .select()
      .single()

    if (errPed) throw errPed

    // Insere itens
    const { error: errItens } = await supabase.from('insumo_pedido_itens').insert(
      itens.map(it => ({
        pedido_id: pedido.id,
        insumo_id: it.insumo_id,
        quantidade: Number(it.quantidade),
        preco_unitario: it.preco_unitario ? Number(it.preco_unitario) : null,
      }))
    )

    if (errItens) throw errItens
    return NextResponse.json(pedido, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

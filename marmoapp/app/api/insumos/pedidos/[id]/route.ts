import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { data, error } = await supabase
      .from('insumo_pedidos')
      .select('*, fornecedoras(nome), insumo_pedido_itens(*, insumos(nome, unidade))')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (error) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const payload: Record<string, unknown> = {}
    if (body.status !== undefined) payload.status = body.status
    if (body.observacoes !== undefined) payload.observacoes = body.observacoes
    if (body.numero_pedido !== undefined) payload.numero_pedido = body.numero_pedido

    const { data, error } = await supabase
      .from('insumo_pedidos')
      .update(payload)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

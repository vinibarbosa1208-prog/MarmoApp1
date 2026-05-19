import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (error) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ ...data, alerta_estoque: Number(data.estoque_atual) <= Number(data.estoque_minimo) })
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
    if (body.nome !== undefined) payload.nome = body.nome
    if (body.unidade !== undefined) payload.unidade = body.unidade
    if (body.categoria !== undefined) payload.categoria = body.categoria
    if (body.estoque_minimo !== undefined) payload.estoque_minimo = Number(body.estoque_minimo)
    if (body.preco_unitario !== undefined) payload.preco_unitario = body.preco_unitario ? Number(body.preco_unitario) : null

    const { data, error } = await supabase
      .from('insumos')
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { error } = await supabase
      .from('insumos')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

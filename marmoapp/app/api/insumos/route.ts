import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .eq('marmoraria_id', marmoraria_id)
      .order('nome')

    if (error) throw error

    const result = (data || []).map(i => ({
      ...i,
      alerta_estoque: Number(i.estoque_atual) <= Number(i.estoque_minimo),
    }))

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('insumos')
      .insert({
        marmoraria_id,
        nome: body.nome.trim(),
        unidade: body.unidade || 'un',
        categoria: body.categoria || null,
        estoque_atual: Number(body.estoque_atual) || 0,
        estoque_minimo: Number(body.estoque_minimo) || 0,
        preco_unitario: body.preco_unitario ? Number(body.preco_unitario) : null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

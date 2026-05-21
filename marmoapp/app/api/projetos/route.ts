import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const status = req.nextUrl.searchParams.get('status')
    const orcamento_id = req.nextUrl.searchParams.get('orcamento_id')

    let query = supabase
      .from('projetos')
      .select('*, clientes(nome)')
      .eq('marmoraria_id', marmoraria_id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (orcamento_id) query = query.eq('orcamento_id', orcamento_id)

    const { data, error } = await query
    if (error) throw error

    const projetos = (data || []).map(p => ({
      ...p,
      cliente_nome: p.clientes?.nome ?? null,
      clientes: undefined,
      margem_percentual: p.valor_venda > 0 ? Math.round((p.margem_lucro / p.valor_venda) * 10000) / 100 : 0,
    }))

    return NextResponse.json(projetos)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    if (!body.titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('projetos')
      .insert({
        marmoraria_id,
        titulo: body.titulo.trim(),
        descricao: body.descricao || null,
        valor_venda: Number(body.valor_venda) || 0,
        status: body.status || 'em_andamento',
        cliente_id: body.cliente_id || null,
        orcamento_id: body.orcamento_id || null,
        data_inicio: body.data_inicio || null,
        data_conclusao: body.data_conclusao || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { data, error } = await supabase
      .from('insumo_retiradas')
      .select('*')
      .eq('insumo_id', id)
      .eq('marmoraria_id', marmoraria_id)
      .order('data_retirada', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id: insumo_id } = await params
    const body = await req.json()

    if (!body.funcionario_nome?.trim()) return NextResponse.json({ error: 'Funcionário obrigatório' }, { status: 400 })
    const quantidade = Number(body.quantidade)
    if (!quantidade || quantidade <= 0) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })

    // Busca estoque atual
    const { data: insumo, error: errInsumo } = await supabase
      .from('insumos')
      .select('estoque_atual, estoque_minimo')
      .eq('id', insumo_id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (errInsumo || !insumo) return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })

    const novoEstoque = Number(insumo.estoque_atual) - quantidade

    const [{ data: retirada, error: errRet }, { error: errUp }] = await Promise.all([
      supabase.from('insumo_retiradas').insert({
        marmoraria_id,
        insumo_id,
        funcionario_nome: body.funcionario_nome.trim(),
        quantidade,
        data_retirada: body.data_retirada || new Date().toISOString().split('T')[0],
        observacao: body.observacao || null,
      }).select().single(),
      supabase.from('insumos').update({ estoque_atual: novoEstoque }).eq('id', insumo_id),
    ])

    if (errRet) throw errRet
    if (errUp) throw errUp

    return NextResponse.json({
      ...retirada,
      estoque_atual: novoEstoque,
      alerta_estoque: novoEstoque <= Number(insumo.estoque_minimo),
    }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('insumo_solicitacoes')
      .select('*, insumos(nome, unidade, categoria)')
      .eq('marmoraria_id', marmoraria_id)
      .order('data_solicitacao', { ascending: false })
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

    if (!body.solicitado_por?.trim()) {
      return NextResponse.json({ error: 'Quem pediu é obrigatório' }, { status: 400 })
    }
    const insumo_id: string | null = body.insumo_id || null
    const descricao_livre: string | null = body.descricao_livre?.trim() || null
    if (!insumo_id && !descricao_livre) {
      return NextResponse.json({ error: 'Selecione um insumo do catálogo ou descreva o item' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('insumo_solicitacoes')
      .insert({
        marmoraria_id,
        insumo_id,
        descricao_livre,
        quantidade: body.quantidade ? Number(body.quantidade) : null,
        unidade: body.unidade || null,
        solicitado_por: body.solicitado_por.trim(),
        observacao: body.observacao || null,
        data_solicitacao: body.data_solicitacao || new Date().toISOString().split('T')[0],
        status: 'pendente',
      })
      .select('*, insumos(nome, unidade, categoria)')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

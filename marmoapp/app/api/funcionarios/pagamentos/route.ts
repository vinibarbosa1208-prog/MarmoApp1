import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const funcionario_id = req.nextUrl.searchParams.get('funcionario_id')

    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('marmoraria_id', marmoraria_id)

    const funcIds = (funcs ?? []).map(f => f.id)
    if (!funcIds.length) return NextResponse.json([])

    let query = supabase
      .from('funcionario_pagamentos')
      .select('*, funcionarios(id, nome)')
      .in('funcionario_id', funcIds)
      .order('data', { ascending: false })

    if (funcionario_id) {
      query = query.eq('funcionario_id', funcionario_id)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()

    if (!body.funcionario_id) return NextResponse.json({ error: 'Funcionário obrigatório' }, { status: 400 })
    if (!body.tipo) return NextResponse.json({ error: 'Tipo obrigatório' }, { status: 400 })
    if (!body.valor || Number(body.valor) <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

    const { data: func } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', body.funcionario_id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (!func) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('funcionario_pagamentos')
      .insert({
        marmoraria_id,
        funcionario_id: body.funcionario_id,
        tipo: body.tipo,
        valor: Number(body.valor),
        data: body.data || new Date().toISOString().split('T')[0],
        descricao: body.descricao?.trim() || null,
        semana_referencia: body.semana_referencia || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

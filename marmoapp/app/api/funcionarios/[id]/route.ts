import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

    const tipo_pagamento = body.cargo === 'instalador' ? 'metro_linear' : 'diaria'

    const { data, error } = await supabase
      .from('funcionarios')
      .update({
        nome: body.nome.trim(),
        cargo: body.cargo,
        tipo_pagamento,
        valor_diaria: body.valor_diaria ? Number(body.valor_diaria) : null,
        valor_metro_linear: body.valor_metro_linear ? Number(body.valor_metro_linear) : null,
        telefone: body.telefone?.trim() || null,
        observacoes: body.observacoes?.trim() || null,
        ativo: body.ativo ?? true,
      })
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

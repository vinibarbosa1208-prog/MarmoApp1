import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Reseta a contagem de UM insumo: apaga o historico de retiradas dele e
// define o estoque atual a partir de uma recontagem fisica informada pelo
// usuario. O estoque_minimo (usado no alerta de estoque baixo) nao muda.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id: insumo_id } = await params
    const body = await req.json()

    const novoEstoque = Number(body.novo_estoque)
    if (body.novo_estoque === undefined || body.novo_estoque === null || Number.isNaN(novoEstoque) || novoEstoque < 0) {
      return NextResponse.json({ error: 'Informe a nova contagem (número maior ou igual a 0)' }, { status: 400 })
    }

    const { data: insumo, error: errInsumo } = await supabase
      .from('insumos')
      .select('estoque_atual, estoque_minimo')
      .eq('id', insumo_id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (errInsumo || !insumo) return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })

    const { data: removidas, error: errDel } = await supabase
      .from('insumo_retiradas')
      .delete()
      .eq('insumo_id', insumo_id)
      .eq('marmoraria_id', marmoraria_id)
      .select('id')

    if (errDel) throw errDel

    const { data: atualizado, error: errUp } = await supabase
      .from('insumos')
      .update({ estoque_atual: novoEstoque })
      .eq('id', insumo_id)
      .eq('marmoraria_id', marmoraria_id)
      .select()
      .single()

    if (errUp) throw errUp

    const { error: errLog } = await supabase.from('insumo_reset_log').insert({
      marmoraria_id,
      insumo_id,
      lote_id: randomUUID(),
      tipo: 'individual',
      estoque_anterior: insumo.estoque_atual,
      estoque_novo: novoEstoque,
      retiradas_removidas: removidas?.length || 0,
    })
    if (errLog) throw errLog

    return NextResponse.json({
      ...atualizado,
      alerta_estoque: Number(atualizado.estoque_atual) <= Number(atualizado.estoque_minimo),
      retiradas_removidas: removidas?.length || 0,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

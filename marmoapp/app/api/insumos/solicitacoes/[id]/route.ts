import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Remove uma solicitação lançada por engano (ex: digitada duplicada). Para o
// fluxo normal (comprou/não precisa mais), usar a rota de status — deletar é
// só para corrigir erro de digitação, sem deixar rastro.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { error } = await supabase
      .from('insumo_solicitacoes')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// Atualiza status manualmente — hoje só usado para "cancelado" (pedido não é
// mais necessário, mas mantém o registro pra histórico). Marcar como
// "comprado" tem rota própria (./comprar) porque também grava a data.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    if (!['pendente', 'cancelado'].includes(body.status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('insumo_solicitacoes')
      .update({ status: body.status })
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('*, insumos(nome, unidade, categoria)')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

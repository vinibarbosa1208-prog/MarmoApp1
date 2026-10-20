import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

// PATCH — editar campos, dar baixa (status=pago) ou estornar (status=previsto).
// Baixa de um pedido de insumos também marca o pedido como pago na aba Insumos.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { id } = await params
    const b = await req.json()

    const { data: atual, error: errAtual } = await supabase
      .from('financeiro_lancamentos').select('*').eq('id', id).eq('marmoraria_id', marmoraria_id).single()
    if (errAtual || !atual) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

    const sincronizado = atual.origem === 'insumo_pedido' || atual.origem === 'funcionario_pagamento'
    const payload: Record<string, unknown> = {}

    if (b.status !== undefined) {
      if (!['previsto', 'pago', 'cancelado'].includes(b.status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
      if (atual.origem === 'funcionario_pagamento') return NextResponse.json({ error: 'Pagamentos de equipe são controlados em Funcionários' }, { status: 400 })
      payload.status = b.status
      payload.data_pagamento = b.status === 'pago' ? (b.data_pagamento || new Date().toISOString().slice(0, 10)) : null
      if (b.forma_pagamento !== undefined) payload.forma_pagamento = b.forma_pagamento || null
      if (b.status === 'pago' && b.valor !== undefined && !sincronizado) {
        const v = Number(b.valor)
        if (!(v > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
        payload.valor = v
      }
    }
    if (b.vencimento !== undefined) payload.vencimento = b.vencimento
    if (b.observacao !== undefined) payload.observacao = b.observacao || null
    if (b.forma_pagamento !== undefined) payload.forma_pagamento = b.forma_pagamento || null
    if (!sincronizado) {
      if (b.descricao !== undefined) payload.descricao = String(b.descricao).trim()
      if (b.contraparte !== undefined) payload.contraparte = b.contraparte || null
      if (b.categoria !== undefined) payload.categoria = b.categoria
      if (b.valor !== undefined && b.status === undefined) {
        const v = Number(b.valor)
        if (!(v > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
        payload.valor = v
      }
      if (b.acompanha_instalacao !== undefined) payload.acompanha_instalacao = !!b.acompanha_instalacao
    }

    const { data, error } = await supabase
      .from('financeiro_lancamentos').update(payload).eq('id', id).eq('marmoraria_id', marmoraria_id).select().single()
    if (error) throw error

    // Mantém a aba Insumos coerente com a baixa feita aqui.
    if (atual.insumo_pedido_id && b.status !== undefined && b.status !== atual.status) {
      if (b.status === 'pago') {
        await supabase.from('insumo_pedidos')
          .update({ status: 'pago', data_pagamento: payload.data_pagamento })
          .eq('id', atual.insumo_pedido_id).eq('marmoraria_id', marmoraria_id)
      } else if (atual.status === 'pago') {
        const { data: ped } = await supabase.from('insumo_pedidos').select('data_recebimento')
          .eq('id', atual.insumo_pedido_id).single()
        await supabase.from('insumo_pedidos')
          .update({ status: ped?.data_recebimento ? 'recebido' : 'pendente', data_pagamento: null })
          .eq('id', atual.insumo_pedido_id).eq('marmoraria_id', marmoraria_id)
      }
    }

    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { id } = await params

    const { data: atual } = await supabase
      .from('financeiro_lancamentos').select('origem').eq('id', id).eq('marmoraria_id', marmoraria_id).single()
    if (!atual) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    if (atual.origem === 'insumo_pedido') return NextResponse.json({ error: 'Esse lançamento vem de um pedido de insumos — exclua ou cancele o pedido em Insumos' }, { status: 400 })
    if (atual.origem === 'funcionario_pagamento') return NextResponse.json({ error: 'Esse lançamento vem de Funcionários — exclua o pagamento por lá' }, { status: 400 })
    if (atual.origem === 'recorrencia') return NextResponse.json({ error: 'Despesa fixa: use "Cancelar" pra pular este mês, ou desative a despesa na aba Despesas fixas' }, { status: 400 })

    const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id).eq('marmoraria_id', marmoraria_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

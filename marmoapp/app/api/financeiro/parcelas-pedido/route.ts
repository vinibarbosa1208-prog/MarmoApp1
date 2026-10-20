import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

// GET — pedidos aprovados/fechados com o quanto já tem de parcela lançada.
// Usado pra mostrar "pedidos sem parcelas" na aba A Receber.
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: orcs, error } = await supabase
      .from('orcamentos')
      .select('id, numero, titulo, total, data_fechamento, data_prevista_instalacao, status, crm_status, clientes(nome)')
      .eq('marmoraria_id', marmoraria_id)
      .or('status.eq.aprovado,crm_status.eq.fechado')
      .order('numero', { ascending: false })
    if (error) throw error

    const ids = (orcs || []).map(o => o.id)
    const lancadoPorOrc: Record<string, number> = {}
    if (ids.length) {
      const { data: lanc, error: e2 } = await supabase
        .from('financeiro_lancamentos')
        .select('orcamento_id, valor, status')
        .eq('marmoraria_id', marmoraria_id)
        .eq('tipo', 'receber')
        .in('orcamento_id', ids)
      if (e2) throw e2
      for (const l of lanc || []) {
        if (l.status === 'cancelado' || !l.orcamento_id) continue
        lancadoPorOrc[l.orcamento_id] = (lancadoPorOrc[l.orcamento_id] || 0) + Number(l.valor)
      }
    }

    return NextResponse.json((orcs || []).map(o => ({
      ...o,
      cliente_nome: (o.clientes as unknown as { nome: string } | null)?.nome ?? null,
      total_lancado: Math.round((lancadoPorOrc[o.id] || 0) * 100) / 100,
    })))
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

// POST { orcamento_id, parcelas: [{ rotulo, valor, vencimento, acompanha_instalacao }] }
// Substitui as parcelas ainda não recebidas do pedido pelas novas.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const b = await req.json()
    const parcelas: { rotulo?: string; valor: number; vencimento: string; acompanha_instalacao?: boolean; forma_pagamento?: string; recebido?: boolean }[] = b.parcelas || []
    if (!b.orcamento_id) return NextResponse.json({ error: 'Pedido obrigatório' }, { status: 400 })

    const { data: orc } = await supabase
      .from('orcamentos')
      .select('id, numero, titulo, data_prevista_instalacao, clientes(nome)')
      .eq('id', b.orcamento_id).eq('marmoraria_id', marmoraria_id).single()
    if (!orc) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const validas = parcelas.filter(p => Number(p.valor) > 0)
    for (const p of validas) {
      if (!p.vencimento && !(p.acompanha_instalacao && orc.data_prevista_instalacao && !p.recebido)) {
        return NextResponse.json({ error: 'Toda parcela precisa de vencimento (ou data de instalação definida)' }, { status: 400 })
      }
    }

    if (!b.acrescentar) {
      const { error: errDel } = await supabase
        .from('financeiro_lancamentos')
        .delete()
        .eq('marmoraria_id', marmoraria_id)
        .eq('orcamento_id', orc.id)
        .eq('origem', 'orcamento')
        .eq('status', 'previsto')
      if (errDel) throw errDel
    }

    if (!validas.length) return NextResponse.json([])

    const cliente = (orc.clientes as unknown as { nome: string } | null)?.nome ?? null
    const prefixo = `Pedido #${orc.numero ?? ''}`.trim()
    const hoje = new Date().toISOString().slice(0, 10)
    const rows = validas.map((p, i) => ({
      marmoraria_id,
      tipo: 'receber',
      categoria: 'venda',
      descricao: `${prefixo} — ${p.rotulo || `Parcela ${i + 1}`}`,
      contraparte: cliente,
      valor: Math.round(Number(p.valor) * 100) / 100,
      vencimento: p.acompanha_instalacao && orc.data_prevista_instalacao && !p.vencimento ? orc.data_prevista_instalacao : p.vencimento,
      origem: 'orcamento',
      orcamento_id: orc.id,
      acompanha_instalacao: !!p.acompanha_instalacao && !p.recebido,
      forma_pagamento: p.forma_pagamento || null,
      status: p.recebido ? 'pago' : 'previsto',
      data_pagamento: p.recebido ? (p.vencimento || hoje) : null,
      parcela_num: validas.length > 1 ? i + 1 : null,
      parcela_total: validas.length > 1 ? validas.length : null,
    }))

    const { data, error } = await supabase.from('financeiro_lancamentos').insert(rows).select()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

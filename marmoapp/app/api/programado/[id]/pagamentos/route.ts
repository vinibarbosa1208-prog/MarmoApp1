import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, getAuthUserId, apiSupabase as supabase } from '@/lib/api-auth'
import { carregarAdesao, confirmarPagamento } from '@/lib/minha-pia/cobranca'
import { errMsg } from '@/lib/minha-pia/servidor'
import { STATUS_PAGANDO } from '@/lib/minha-pia/regras'

type Ctx = { params: Promise<{ id: string }> }

// POST — baixa manual (Pix por chave, dinheiro, etc.).
// { pagamento_id? } confirma uma cobrança em aberto; sem ele, lança um
// pagamento novo { valor, forma, data }.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const usuario = await getAuthUserId()
    const { id } = await params
    const adesao = await carregarAdesao(id, marmoraria_id)
    if (!adesao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (!STATUS_PAGANDO.includes(adesao.status)) return NextResponse.json({ error: 'Este plano não está recebendo pagamentos.' }, { status: 400 })

    const b = await req.json().catch(() => ({}))
    const forma = ['pix', 'dinheiro', 'manual', 'cartao', 'boleto'].includes(b.forma) ? b.forma : 'pix'
    const pagoEm = b.data ? new Date(b.data + 'T12:00:00-03:00').toISOString() : undefined

    if (b.pagamento_id) {
      const { data: pag } = await supabase.from('programado_pagamentos').select('id').eq('id', b.pagamento_id).eq('adesao_id', id).maybeSingle()
      if (!pag) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
      await confirmarPagamento(pag.id, { pagoEm, forma, registradoPor: usuario, valorRecebido: Number(b.valor) || undefined })
      return NextResponse.json({ ok: true })
    }

    const valor = Math.round(Number(b.valor) * 100) / 100
    const saldo = Number(adesao.valor_total) - Number(adesao.total_pago) - Number(adesao.desconto)
    if (!(valor > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    if (valor > saldo + 0.009) return NextResponse.json({ error: `O valor passa do saldo (R$ ${saldo.toFixed(2)}).` }, { status: 400 })

    const { data: novo, error } = await supabase.from('programado_pagamentos').insert({
      marmoraria_id, adesao_id: id, tipo: valor >= saldo - 0.009 ? 'quitacao' : 'parcela', valor,
      status: 'pendente', forma, observacao: typeof b.observacao === 'string' ? b.observacao.slice(0, 300) : null,
    }).select('id').single()
    if (error) throw error
    await confirmarPagamento(novo.id, { pagoEm, forma, registradoPor: usuario })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

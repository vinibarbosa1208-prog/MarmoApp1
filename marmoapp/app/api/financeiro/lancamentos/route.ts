import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

// GET /api/financeiro/lancamentos?tipo=receber|pagar&de=YYYY-MM-DD&ate=YYYY-MM-DD
// Antes de listar, gera os lançamentos das despesas fixas até 3 meses à frente
// (idempotente — não duplica).
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const tipo = sp.get('tipo')
    const de = sp.get('de')
    const ate = sp.get('ate')

    const horizonte = new Date()
    horizonte.setMonth(horizonte.getMonth() + 3)
    await supabase.rpc('financeiro_gerar_recorrencias', {
      p_marmoraria_id: marmoraria_id,
      p_ate: horizonte.toISOString().slice(0, 10),
    })

    let q = supabase
      .from('financeiro_lancamentos')
      .select('*, orcamentos(numero, titulo)')
      .eq('marmoraria_id', marmoraria_id)
      .order('vencimento', { ascending: true })
      .order('created_at', { ascending: true })
    if (tipo === 'receber' || tipo === 'pagar') q = q.eq('tipo', tipo)
    if (de) q = q.gte('vencimento', de)
    if (ate) q = q.lte('vencimento', ate)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

// POST — lançamento manual ou compra programada.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const b = await req.json()
    if (b.tipo !== 'receber' && b.tipo !== 'pagar') return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    if (!b.descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
    const valor = Number(b.valor)
    if (!(valor > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    if (!b.vencimento) return NextResponse.json({ error: 'Vencimento obrigatório' }, { status: 400 })

    const origem = b.origem === 'compra_programada' ? 'compra_programada' : 'manual'
    const pago = b.status === 'pago'

    // Parcelamento simples: repete mês a mês
    const nParcelas = Math.max(1, Math.min(60, Number(b.parcelas) || 1))
    const valorParcela = Math.round((valor / nParcelas) * 100) / 100
    const rows = Array.from({ length: nParcelas }, (_, i) => {
      const d = new Date(b.vencimento + 'T12:00:00')
      d.setMonth(d.getMonth() + i)
      const v = i === nParcelas - 1 ? Math.round((valor - valorParcela * (nParcelas - 1)) * 100) / 100 : valorParcela
      return {
        marmoraria_id,
        tipo: b.tipo,
        categoria: b.categoria || 'outros',
        descricao: b.descricao.trim() + (nParcelas > 1 ? ` (${i + 1}/${nParcelas})` : ''),
        contraparte: b.contraparte?.trim() || null,
        valor: v,
        vencimento: d.toISOString().slice(0, 10),
        status: pago && i === 0 ? 'pago' : 'previsto',
        data_pagamento: pago && i === 0 ? (b.data_pagamento || d.toISOString().slice(0, 10)) : null,
        forma_pagamento: b.forma_pagamento || null,
        observacao: b.observacao || null,
        origem,
        orcamento_id: b.orcamento_id || null,
        parcela_num: nParcelas > 1 ? i + 1 : null,
        parcela_total: nParcelas > 1 ? nParcelas : null,
        sugestao_chave: b.sugestao_chave || null,
      }
    })

    const { data, error } = await supabase.from('financeiro_lancamentos').insert(rows).select()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

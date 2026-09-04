import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

interface Contagem { insumo_id: string; novo_estoque: number }

// Reset geral: apaga TODO o historico de retiradas da marmoraria e define o
// estoque atual de cada insumo a partir de uma recontagem fisica. Nao mexe
// em pedidos de compra / fornecedoras nem no estoque_minimo de cada insumo
// (o alerta de estoque baixo continua funcionando normalmente depois).
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const contagens: Contagem[] = Array.isArray(body.contagens) ? body.contagens : []
    if (!contagens.length) return NextResponse.json({ error: 'Informe a recontagem de ao menos um insumo' }, { status: 400 })

    for (const c of contagens) {
      const v = Number(c.novo_estoque)
      if (!c.insumo_id || Number.isNaN(v) || v < 0) {
        return NextResponse.json({ error: 'Recontagem inválida — confira se todos os campos foram preenchidos com números válidos' }, { status: 400 })
      }
    }

    // Confirma que os insumos pertencem a esta marmoraria e guarda o estoque anterior
    const { data: insumosAtuais, error: errInsumos } = await supabase
      .from('insumos')
      .select('id, estoque_atual')
      .eq('marmoraria_id', marmoraria_id)
      .in('id', contagens.map(c => c.insumo_id))

    if (errInsumos) throw errInsumos
    const anteriorPorId = new Map((insumosAtuais || []).map(i => [i.id, Number(i.estoque_atual)]))

    // Conta quantas retiradas cada insumo tinha, antes de apagar tudo
    const { data: retiradasAtuais, error: errRetAtuais } = await supabase
      .from('insumo_retiradas')
      .select('insumo_id')
      .eq('marmoraria_id', marmoraria_id)

    if (errRetAtuais) throw errRetAtuais
    const contagemRetiradasPorId = new Map<string, number>()
    for (const r of retiradasAtuais || []) {
      contagemRetiradasPorId.set(r.insumo_id, (contagemRetiradasPorId.get(r.insumo_id) || 0) + 1)
    }

    // Apaga todo o historico de retiradas da marmoraria
    const { error: errDel } = await supabase
      .from('insumo_retiradas')
      .delete()
      .eq('marmoraria_id', marmoraria_id)

    if (errDel) throw errDel

    const lote_id = randomUUID()

    // Atualiza o estoque de cada insumo recontado
    await Promise.all(contagens.map(c =>
      supabase.from('insumos').update({ estoque_atual: Number(c.novo_estoque) })
        .eq('id', c.insumo_id).eq('marmoraria_id', marmoraria_id)
    ))

    // Registra o log de auditoria do reset
    const { error: errLog } = await supabase.from('insumo_reset_log').insert(
      contagens
        .filter(c => anteriorPorId.has(c.insumo_id))
        .map(c => ({
          marmoraria_id,
          insumo_id: c.insumo_id,
          lote_id,
          tipo: 'geral' as const,
          estoque_anterior: anteriorPorId.get(c.insumo_id) ?? 0,
          estoque_novo: Number(c.novo_estoque),
          retiradas_removidas: contagemRetiradasPorId.get(c.insumo_id) || 0,
        }))
    )
    if (errLog) throw errLog

    return NextResponse.json({
      ok: true,
      insumos_atualizados: contagens.length,
      retiradas_removidas: (retiradasAtuais || []).length,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

// Lançamentos futuros ainda não pagos dessa despesa — reescritos quando a
// despesa muda ou é desativada (os já pagos ficam como histórico).
async function limparFuturos(marmoraria_id: string, id: string) {
  const hoje = new Date().toISOString().slice(0, 10)
  await supabase.from('financeiro_lancamentos').delete()
    .eq('marmoraria_id', marmoraria_id).eq('recorrencia_id', id)
    .eq('status', 'previsto').gte('vencimento', hoje)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { id } = await params
    const b = await req.json()

    const payload: Record<string, unknown> = {}
    if (b.descricao !== undefined) payload.descricao = String(b.descricao).trim()
    if (b.contraparte !== undefined) payload.contraparte = b.contraparte || null
    if (b.categoria !== undefined) payload.categoria = b.categoria
    if (b.valor !== undefined) {
      const v = Number(b.valor)
      if (!(v > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      payload.valor = v
    }
    if (b.dia_vencimento !== undefined) {
      const d = Number(b.dia_vencimento)
      if (!(d >= 1 && d <= 31)) return NextResponse.json({ error: 'Dia inválido' }, { status: 400 })
      payload.dia_vencimento = d
    }
    if (b.fim !== undefined) payload.fim = b.fim || null
    if (b.ativo !== undefined) payload.ativo = !!b.ativo

    const { data, error } = await supabase.from('financeiro_recorrencias')
      .update(payload).eq('id', id).eq('marmoraria_id', marmoraria_id).select().single()
    if (error) throw error

    await limparFuturos(marmoraria_id, id)
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
    await limparFuturos(marmoraria_id, id)
    const { error } = await supabase.from('financeiro_recorrencias').delete().eq('id', id).eq('marmoraria_id', marmoraria_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

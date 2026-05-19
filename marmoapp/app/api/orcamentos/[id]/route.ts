import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: orc, error: findErr } = await supabase
      .from('orcamentos')
      .select('id')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()

    if (findErr) throw findErr
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

    const { error: itemsErr } = await supabase
      .from('orcamento_itens')
      .delete()
      .eq('orcamento_id', id)

    if (itemsErr) throw itemsErr

    const { error: delErr } = await supabase
      .from('orcamentos')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)

    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

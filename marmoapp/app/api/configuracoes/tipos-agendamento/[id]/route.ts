import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as { nome?: string; cor?: string }
    const update: Record<string, string> = {}
    if (body.nome?.trim()) update.nome = body.nome.trim()
    if (body.cor) update.cor = body.cor

    const { data, error } = await supabase
      .from('agenda_event_types')
      .update(update)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Tipo não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { count } = await supabase
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_id', id)
      .eq('marmoraria_id', marmoraria_id)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Este tipo está vinculado a ${count} evento(s) e não pode ser excluído.` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('agenda_event_types')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

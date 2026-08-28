import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// PUT /api/agenda/events/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    // Prevent changing marmoraria_id
    delete body.marmoraria_id

    const { data, error } = await supabase
      .from('agenda_events')
      .update(body)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('*, tipo:agenda_event_types(id,nome,cor,icone), funcionario:funcionarios(id,nome,cargo)')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/agenda/events/[id] — muda status para 'cancelado', não deleta
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('agenda_events')
      .update({ status: 'cancelado' })
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('id, status')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

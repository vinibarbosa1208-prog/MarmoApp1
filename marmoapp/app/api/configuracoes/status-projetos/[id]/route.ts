import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as { nome?: string; cor?: string; ordem?: number }
    const update: Record<string, string | number> = {}
    if (body.nome?.trim()) update.nome = body.nome.trim()
    if (body.cor) update.cor = body.cor
    if (body.ordem !== undefined) update.ordem = body.ordem

    const { data, error } = await supabase
      .from('project_custom_statuses')
      .update(update)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Status não encontrado' }, { status: 404 })
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

    const { error } = await supabase
      .from('project_custom_statuses')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// DELETE /api/projetos/[id]/custos/[custoId] — deleta fisicamente
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; custoId: string }> }
) {
  try {
    const { id, custoId } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Verify project belongs to marmoraria
    const { data: projeto } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()

    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { error } = await supabase
      .from('project_costs')
      .delete()
      .eq('id', custoId)
      .eq('project_id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

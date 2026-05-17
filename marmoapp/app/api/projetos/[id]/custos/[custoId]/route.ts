import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data } = await supabase.from('usuarios').select('marmoraria_id').eq('id', user.id).maybeSingle()
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

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

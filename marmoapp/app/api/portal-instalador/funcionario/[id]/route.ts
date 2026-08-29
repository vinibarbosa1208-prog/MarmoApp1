import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

// Confirma que o id escolhido na tela de identificação é mesmo um
// instalador ativo dessa marmoraria antes de devolver qualquer coisa —
// sem isso, alguém poderia passar qualquer uuid na URL.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = getPortalMarmorariaId()

    const { data, error } = await supabase
      .from('funcionarios')
      .select('id, nome, valor_metro_linear')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', 'instalador')
      .eq('ativo', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Instalador não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

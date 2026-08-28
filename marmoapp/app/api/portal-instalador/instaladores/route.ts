import { NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

// Sem autenticação de propósito — decisão de 28/08 (item 5b do backlog):
// portal do instalador não tem login, só identificação por nome. Roda
// inteiramente no servidor com service role; nunca expor essa lógica via
// client direto com a chave anon.
export async function GET() {
  try {
    const marmoraria_id = getPortalMarmorariaId()
    const { data, error } = await supabase
      .from('funcionarios')
      .select('id, nome')
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', 'instalador')
      .eq('ativo', true)
      .order('nome')

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

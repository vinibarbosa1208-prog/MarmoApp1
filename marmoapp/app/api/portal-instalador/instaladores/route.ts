import { NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId, portalInstaladorAtivo, MENSAGEM_PORTAL_DESATIVADO } from '@/lib/portal-instalador-config'

// Sem autenticação de propósito — decisão de 28/08 (item 5b do backlog):
// portal do instalador não tem login, só identificação por nome. Roda
// inteiramente no servidor com service role; nunca expor essa lógica via
// client direto com a chave anon.
export async function GET() {
  try {
    const marmoraria_id = getPortalMarmorariaId()
    // Ficha semanal de produção (06/10/2026): com a flag desligada, a tela
    // de identificação mostra o aviso de desativação no lugar da lista de
    // nomes — devolver 410 aqui é o sinal que a página usa pra trocar uma
    // coisa pela outra.
    if (!(await portalInstaladorAtivo(marmoraria_id))) {
      return NextResponse.json({ error: MENSAGEM_PORTAL_DESATIVADO }, { status: 410 })
    }
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

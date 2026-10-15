import { apiSupabase as supabase } from '@/lib/api-auth'

// Portal do instalador (fase 5b) — decisão de 28/08: sem login, sem sessão.
// Todas as rotas do portal precisam saber de qual marmoraria buscar dados,
// mas não há `getUser()` pra derivar isso. Enquanto só existe uma marmoraria
// (Real Pedras), usamos esse id fixo; quando expandirmos pra outras
// marmorarias, troque por uma resolução de tenant de verdade (ex: slug na
// URL) — as rotas já recebem/filtram por marmoraria_id, então não deve ser
// um retrabalho grande.
export function getPortalMarmorariaId(): string {
  return process.env.PORTAL_INSTALADOR_MARMORARIA_ID || 'a7f52e2a-bca6-4270-a35c-99e7988b067d'
}

// Ficha semanal de produção (06/10/2026): o portal deixa de aceitar
// registros novos — quem substitui é a ficha. `portal_instalador_ativo`
// em `marmorarias` controla isso sem precisar de deploy, pro caso de
// precisarem reativar. Histórico, fotos e a aba Aprovações continuam
// funcionando normalmente com a flag desligada; só a ESCRITA de novos
// registros (e a lista de nomes da tela de identificação) é bloqueada.
export const MENSAGEM_PORTAL_DESATIVADO = 'Os registros de instalação agora são feitos pela ficha semanal'

export async function portalInstaladorAtivo(marmoraria_id: string): Promise<boolean> {
  const { data } = await supabase
    .from('marmorarias')
    .select('portal_instalador_ativo')
    .eq('id', marmoraria_id)
    .maybeSingle()
  return data?.portal_instalador_ativo === true
}

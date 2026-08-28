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

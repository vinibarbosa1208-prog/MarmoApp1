-- Bug pré-existente encontrado testando o portal do instalador (29/08):
-- producao_apontamentos nunca recebeu os GRANTs padrão do Supabase
-- (anon/authenticated/service_role), só 'postgres'. A RLS da tabela já
-- estava correta (producao_apontamentos_proprio_tenant), mas sem o GRANT
-- de base o Postgres nega o acesso antes de sequer consultar a policy —
-- por isso a tabela sempre esteve com zero linhas: nenhum insert nela
-- jamais funcionou, nem o da fila (corte/acabamento) nem o do portal.
grant select, insert, update, delete, references, trigger, truncate
  on table public.producao_apontamentos
  to anon, authenticated, service_role;

-- O projeto não dá privilégios automáticos a tabelas novas: sem este grant,
-- a service role do painel recebia "permission denied" (dashboard fora do ar em 10/11/2026).
-- Só a service_role recebe acesso; anon e authenticated continuam sem nada.
grant select, insert, update, delete on table
  public.admin_clientes,
  public.admin_fin_lancamentos,
  public.admin_fin_investimentos,
  public.diagnosticos,
  public.contratos
to service_role;
grant usage, select on sequence public.contratos_numero_seq to service_role;

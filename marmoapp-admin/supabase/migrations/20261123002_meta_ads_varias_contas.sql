-- Meta Ads: várias contas de anúncios (conta MarmoApp + conta pessoal do Vinicius).
alter table public.admin_meta_campanhas
  add column if not exists account_id text,
  add column if not exists orcamento_total numeric(12,2);
update public.admin_meta_campanhas set account_id = '1758707508340997' where account_id is null;
-- inicio/fim passam a vir de start_time/stop_time da campanha (antes guardavam a janela da consulta).
update public.admin_meta_campanhas set inicio = null, fim = null;
create index if not exists admin_meta_campanhas_conta_idx on public.admin_meta_campanhas (account_id);

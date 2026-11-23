-- Meta Ads: resumo da conta (situação, total gasto, saldo, cartão) e totais desde o início por campanha.

create table if not exists public.admin_meta_conta (
  account_id text primary key,
  nome text,
  status integer,
  motivo_bloqueio integer,
  moeda text,
  gasto_total numeric(14,2),
  saldo numeric(14,2),
  limite_gasto numeric(14,2),
  forma_pagamento text,
  cobrancas jsonb,
  outras_contas jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.admin_meta_conta enable row level security;
grant select, insert, update, delete on table public.admin_meta_conta to service_role;

alter table public.admin_meta_campanhas
  add column if not exists gasto_total numeric(14,2) not null default 0,
  add column if not exists impressoes_total integer not null default 0,
  add column if not exists cliques_link_total integer not null default 0,
  add column if not exists leads_total integer not null default 0,
  add column if not exists conversas_total integer not null default 0,
  add column if not exists inicio date,
  add column if not exists fim date;

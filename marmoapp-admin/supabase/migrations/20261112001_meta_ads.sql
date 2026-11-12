-- Meta Ads no painel interno: campanhas, números por dia e registro das sincronizações.
-- Só a service role acessa (RLS ligado, sem policies, com grant explícito).

create table if not exists public.admin_meta_campanhas (
  campaign_id text primary key,
  nome text not null,
  status text,
  objetivo text,
  orcamento_diario numeric(12,2),
  investimento_id uuid references public.admin_fin_investimentos(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.admin_meta_insights (
  data date not null,
  campaign_id text not null references public.admin_meta_campanhas(campaign_id) on delete cascade,
  gasto numeric(12,2) not null default 0,
  impressoes integer not null default 0,
  cliques integer not null default 0,
  cliques_link integer not null default 0,
  leads_meta integer not null default 0,
  conversas integer not null default 0,
  bruto jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (data, campaign_id)
);
create index if not exists admin_meta_insights_campanha_idx on public.admin_meta_insights (campaign_id, data);

create table if not exists public.admin_meta_sync (
  id bigint generated always as identity primary key,
  iniciado_em timestamptz not null default now(),
  origem text not null,
  ok boolean not null,
  mensagem text,
  linhas integer not null default 0
);

alter table public.admin_meta_campanhas enable row level security;
alter table public.admin_meta_insights enable row level security;
alter table public.admin_meta_sync enable row level security;

grant select, insert, update, delete on table
  public.admin_meta_campanhas, public.admin_meta_insights, public.admin_meta_sync
to service_role;

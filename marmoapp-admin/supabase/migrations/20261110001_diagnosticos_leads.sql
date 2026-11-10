-- MarmorarIA: cadastro de leads e diagnósticos feitos na call de apresentação.
-- Cada call gera (ou atualiza) um lead em public.leads e um diagnóstico com os
-- números informados pelo dono da marmoraria. Só o painel admin (service role) lê e grava.

-- Leads que chegam pela call nem sempre têm e-mail.
alter table public.leads alter column email drop not null;
alter table public.leads add column if not exists cidade text;
alter table public.leads add column if not exists updated_at timestamptz default now();

create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  data_call date,
  dor text check (dor in ('orcamento', 'prazo', 'cobranca', 'chapa')),
  equipe integer,
  -- Orçamento
  orcamentos_mes integer,
  fechados_mes integer,
  valor_medio numeric(12,2),
  taxa_fechamento integer,
  -- Produção
  obras_fila integer,
  obras_atrasadas_mes integer,
  sabe_entregas boolean,
  -- Estoque
  faltas_chapa_mes integer,
  custo_extra_falta numeric(12,2),
  -- Financeiro
  a_receber numeric(12,2),
  a_receber_vencido numeric(12,2),
  obras_sem_cobranca numeric(12,2),
  -- Resultado do diagnóstico
  valor_na_mesa numeric(12,2),
  valor_total numeric(12,2),
  plano_recomendado text check (plano_recomendado in ('gestao', 'operacao', 'crescimento')),
  resultado text not null default 'em_aberto'
    check (resultado in ('em_aberto', 'fechou', 'vai_pensar', 'perdido')),
  observacoes text,
  -- Tudo o que foi preenchido na apresentação, para reabrir a call como estava.
  estado jsonb not null default '{}'::jsonb,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnosticos_lead_id_idx on public.diagnosticos (lead_id);
create index if not exists diagnosticos_updated_at_idx on public.diagnosticos (updated_at desc);

-- Mesmo padrão de public.leads: RLS ligada e nenhum acesso fora do service role.
alter table public.diagnosticos enable row level security;
drop policy if exists "diagnosticos: apenas service role acessa" on public.diagnosticos;
create policy "diagnosticos: apenas service role acessa" on public.diagnosticos
  for all using (false);

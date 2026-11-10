-- Painel central MarmoApp: classificação dos clientes, financeiro interno
-- (previsão de entradas e saídas) e investimentos de marketing com retorno.
-- Tabelas só do time interno: RLS ligado e nenhuma policy, acesso só pela service role.

-- 1. Classificação de cada marmoraria para o time interno
create table if not exists public.admin_clientes (
  marmoraria_id uuid primary key references public.marmorarias(id) on delete cascade,
  tipo text not null default 'cadastro'
    check (tipo in ('contratante', 'cadastro', 'teste', 'interno')),
  observacao text,
  updated_at timestamptz not null default now()
);
alter table public.admin_clientes enable row level security;

-- 2. Investimentos de marketing (campanhas, eventos, indicações...)
create table if not exists public.admin_fin_investimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal text not null default 'meta'
    check (canal in ('meta', 'google', 'instagram', 'indicacao', 'evento', 'outro')),
  utm_campaign text,
  inicio date,
  fim date,
  orcamento numeric(12,2) not null default 0 check (orcamento >= 0),
  status text not null default 'planejado'
    check (status in ('planejado', 'ativo', 'pausado', 'encerrado')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_fin_investimentos enable row level security;
create index if not exists admin_fin_investimentos_utm_idx on public.admin_fin_investimentos (utm_campaign);

-- 3. Lançamentos: entradas e saídas, únicas ou recorrentes.
-- Uma recorrência gera as próximas datas na tela. Quando uma data é recebida/paga
-- (ou pulada), grava-se um lançamento filho com origem_id = recorrência.
create table if not exists public.admin_fin_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  categoria text not null,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  data_prevista date not null,
  recorrencia text not null default 'unica'
    check (recorrencia in ('unica', 'semanal', 'quinzenal', 'mensal')),
  recorrencia_fim date,
  status text not null default 'previsto'
    check (status in ('previsto', 'realizado', 'cancelado')),
  data_realizada date,
  origem_id uuid references public.admin_fin_lancamentos(id) on delete cascade,
  marmoraria_id uuid references public.marmorarias(id) on delete set null,
  investimento_id uuid references public.admin_fin_investimentos(id) on delete set null,
  observacao text,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origem_id is null or recorrencia = 'unica'),
  check (recorrencia_fim is null or recorrencia_fim >= data_prevista)
);
alter table public.admin_fin_lancamentos enable row level security;
create unique index if not exists admin_fin_lancamentos_ocorrencia_uniq
  on public.admin_fin_lancamentos (origem_id, data_prevista) where origem_id is not null;
create index if not exists admin_fin_lancamentos_data_idx on public.admin_fin_lancamentos (data_prevista);
create index if not exists admin_fin_lancamentos_marmoraria_idx on public.admin_fin_lancamentos (marmoraria_id);
create index if not exists admin_fin_lancamentos_investimento_idx on public.admin_fin_lancamentos (investimento_id);

-- Antônio em 3 frentes (MarmorarIA): vendas, atendimento ao cliente final e follow-up.
-- Só adiciona colunas e uma tabela nova; nada é removido.

alter table public.antonio_sessions
  add column if not exists modo text not null default 'atendimento'
    check (modo in ('vendas', 'atendimento')),
  add column if not exists humano_ate timestamptz,
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists antonio_sessions_tenant_phone_idx
  on public.antonio_sessions (marmoraria_id, phone);

-- 'humano' = mensagem que a equipe mandou pelo celular, registrada para contexto.
alter table public.antonio_messages drop constraint if exists antonio_messages_role_check;
alter table public.antonio_messages add constraint antonio_messages_role_check
  check (role in ('user', 'assistant', 'humano'));

create index if not exists antonio_messages_session_idx
  on public.antonio_messages (session_id, created_at);

-- Registro de cada mensagem de follow-up enviada (evita repetir a mesma etapa).
create table if not exists public.antonio_followups (
  id uuid primary key default gen_random_uuid(),
  marmoraria_id uuid not null references public.marmorarias(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  etapa text not null check (etapa in ('d2', 'd7', 'd15', 'd30', 'retomada', 'encerrar')),
  phone text not null,
  texto text not null,
  status text not null default 'enviado' check (status in ('enviado', 'falhou', 'simulado')),
  enviado_em timestamptz not null default now(),
  unique (orcamento_id, etapa)
);

alter table public.antonio_followups enable row level security;

-- Leitura pelo tenant; escrita só pelo servidor (service_role ignora RLS).
drop policy if exists antonio_followups_leitura_tenant on public.antonio_followups;
create policy antonio_followups_leitura_tenant on public.antonio_followups
  for select using (marmoraria_id = get_marmoraria_id());

grant select on public.antonio_followups to authenticated;
grant select, insert, update, delete on public.antonio_followups to service_role;

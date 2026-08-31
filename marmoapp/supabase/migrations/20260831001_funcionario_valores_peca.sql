-- Fase 12 do portal do instalador: valores padronizados por instalador +
-- tipo de peça (R$/metro linear), pra melhorar o pré-preenchimento do
-- campo já editável no registro de item. Granularidade é por peça+
-- instalador (não só por peça genérica) porque a habilidade/velocidade
-- varia de pessoa pra pessoa — decisão confirmada com o Vinicius.
create table public.funcionario_valores_peca (
  id uuid primary key default gen_random_uuid(),
  marmoraria_id uuid not null references public.marmorarias(id),
  funcionario_id uuid not null references public.funcionarios(id),
  tipo_peca text not null,
  valor_metro_linear numeric not null check (valor_metro_linear > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funcionario_id, tipo_peca)
);

create trigger trg_funcionario_valores_peca_updated_at
  before update on public.funcionario_valores_peca
  for each row execute function set_updated_at();

alter table public.funcionario_valores_peca enable row level security;

create policy "funcionario_valores_peca_proprio_tenant"
on public.funcionario_valores_peca for all
using (marmoraria_id = get_marmoraria_id())
with check (marmoraria_id = get_marmoraria_id());

-- GRANT explícito de propósito — a tabela producao_apontamentos ficou
-- sem isso por muito tempo e nunca funcionou (achado em 29/08). Não
-- repetir o erro: sempre conceder pros 3 papéis, junto com a RLS.
grant select, insert, update, delete, references, trigger, truncate
  on table public.funcionario_valores_peca
  to anon, authenticated, service_role;

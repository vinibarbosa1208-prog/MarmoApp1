-- Ficha semanal de produção e capacidade produtiva (spec de 06/10/2026).
--
-- A fábrica passa a anotar a produção numa ficha de papel por pessoa por
-- semana (seg a sáb) e o gestor digita no MarmoApp. Nada de tabela nova de
-- apontamento: tudo reaproveita `producao_apontamentos`, que já tem etapa,
-- unidade, data, funcionario_id, status e valor_calculado. Esta migration
-- só acrescenta o que a ficha traz e o schema ainda não guardava.
--
-- Constraints conferidas no banco em 06/10/2026 antes de escrever isso.
-- Nenhuma coluna é removida; nenhum check é apertado (só relaxado).

-- ──────────────────────────────────────────────────────────────────────
-- 1) Vínculo de cadastros: duas fichas de cadastro, uma pessoa só
-- ──────────────────────────────────────────────────────────────────────
-- Quem acaba e também instala tem dois cadastros em `funcionarios` (com
-- cargo e forma de pagamento diferentes), mas recebe UMA ficha de papel.
-- `pessoa_id` só é preenchido no cadastro secundário, apontando pro
-- principal — a "pessoa" do sistema é `coalesce(pessoa_id, id)`.
alter table public.funcionarios
  add column if not exists pessoa_id uuid null references public.funcionarios(id);

comment on column public.funcionarios.pessoa_id is
  'Cadastro principal da mesma pessoa física (só no cadastro secundário). A pessoa é coalesce(pessoa_id, id) — usada pra agrupar a ficha semanal de produção.';

create index if not exists funcionarios_pessoa_id_idx
  on public.funcionarios(pessoa_id) where pessoa_id is not null;

-- Um nível só de vínculo: o cadastro principal nunca aponta pra outro
-- (senão `coalesce(pessoa_id, id)` deixaria de resolver numa passada).
create or replace function public.funcionarios_pessoa_id_sem_cadeia()
returns trigger language plpgsql as $$
begin
  if new.pessoa_id is not null then
    if new.pessoa_id = new.id then
      raise exception 'pessoa_id não pode apontar para o próprio cadastro';
    end if;
    if exists (select 1 from public.funcionarios f where f.id = new.pessoa_id and f.pessoa_id is not null) then
      raise exception 'pessoa_id deve apontar para o cadastro principal (o alvo já é um cadastro secundário)';
    end if;
    if exists (select 1 from public.funcionarios f where f.pessoa_id = new.id) then
      raise exception 'este cadastro já é o principal de outro — não pode virar secundário';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_funcionarios_pessoa_id_sem_cadeia on public.funcionarios;
create trigger trg_funcionarios_pessoa_id_sem_cadeia
  before insert or update of pessoa_id on public.funcionarios
  for each row execute function public.funcionarios_pessoa_id_sem_cadeia();

-- ──────────────────────────────────────────────────────────────────────
-- 2) O que a ficha de papel traz e o apontamento ainda não guardava
-- ──────────────────────────────────────────────────────────────────────
alter table public.producao_apontamentos
  add column if not exists tipo_acabamento text null,
  add column if not exists quantidade_sistema numeric null,
  add column if not exists peca_descricao text null,
  add column if not exists medida_comprimento numeric null,
  add column if not exists medida_largura numeric null;

-- R (reto) / ME (meia esquadria) só fazem sentido na etapa de acabamento.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_apontamentos_tipo_acabamento_check') then
    alter table public.producao_apontamentos
      add constraint producao_apontamentos_tipo_acabamento_check
      check (
        tipo_acabamento is null
        or (etapa = 'acabamento' and tipo_acabamento = any (array['reto', 'meia_esquadria']))
      );
  end if;
end;
$$;

comment on column public.producao_apontamentos.tipo_acabamento is
  'R/ME da ficha — reto ou meia esquadria. Só em etapa=acabamento.';
comment on column public.producao_apontamentos.quantidade_sistema is
  'ml/m² que o sistema calculou pra essa peça no momento do lançamento. Guardado só pra medir a divergência ficha × sistema — quem vale é `quantidade` (o número da ficha).';
comment on column public.producao_apontamentos.peca_descricao is
  'Nome curto da peça como veio escrito na ficha. Obrigatório em obra avulsa (que não tem orcamento_item_id pra puxar a descrição).';
comment on column public.producao_apontamentos.medida_comprimento is
  'Corte avulso: comprimento em metros. quantidade = comprimento × largura.';
comment on column public.producao_apontamentos.medida_largura is
  'Corte avulso: largura em metros. quantidade = comprimento × largura.';

-- ──────────────────────────────────────────────────────────────────────
-- 3) Avulso sem local da obra
-- ──────────────────────────────────────────────────────────────────────
-- O portal do instalador exigia nome + local da obra avulsa. A ficha de
-- papel não tem campo de local (o colaborador anota só o cliente), então
-- `obra_local_avulso` passa a ser opcional. `obra_nome_avulso` continua
-- obrigatório — sem ele não dá pra saber de quem é o serviço.
alter table public.producao_apontamentos
  drop constraint if exists producao_apontamentos_retroativo_check;
alter table public.producao_apontamentos
  add constraint producao_apontamentos_retroativo_check
  check (
    (is_retroativo = false and orcamento_id is not null and obra_nome_avulso is null and obra_local_avulso is null)
    or
    (is_retroativo = true and orcamento_id is null and obra_nome_avulso is not null)
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4) Anti-duplicidade entre a ficha e o modal da Fila de Serviços
-- ──────────────────────────────────────────────────────────────────────
-- Os dois caminhos registram a mesma peça na mesma etapa; o índice garante
-- que o segundo ATUALIZE o apontamento existente em vez de criar outro.
-- Rejeitado fica de fora (uma peça rejeitada pode ser relançada).
--
-- Conferido em 06/10/2026: as 33 linhas existentes (21 de corte e 12 de
-- acabamento, todas origem='automatico') têm orcamento_item_id NULL — a
-- Fila gravava um apontamento agregado por pedido, não por peça. Ou seja,
-- nenhuma cai dentro do índice parcial e não há duplicata pra resolver
-- antes de criá-lo.
create unique index if not exists producao_apontamentos_item_etapa_uniq
  on public.producao_apontamentos (orcamento_item_id, etapa)
  where orcamento_item_id is not null and status <> 'rejeitado';

-- Consulta da ficha: linhas de uma pessoa numa semana.
create index if not exists producao_apontamentos_data_func_idx
  on public.producao_apontamentos (marmoraria_id, data, funcionario_id);

-- ──────────────────────────────────────────────────────────────────────
-- 5) Configuração da marmoraria
-- ──────────────────────────────────────────────────────────────────────
-- `fator_meia_esquadria`: quanto 1 ml de meia esquadria vale em ml de
-- reto, pra somar os dois numa medida única de capacidade ("ml
-- equivalente"). Começa em 1 (ME = reto) e é recalibrado com os dados
-- reais — o relatório sugere o fator medido, o gestor confirma aqui.
--
-- `portal_instalador_ativo`: a ficha substitui o portal pra registros
-- novos. A flag deixa reativar sem deploy se mudarem de ideia; o histórico
-- e a aba Aprovações continuam funcionando com ela desligada.
alter table public.marmorarias
  add column if not exists fator_meia_esquadria numeric not null default 1,
  add column if not exists portal_instalador_ativo boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'marmorarias_fator_meia_esquadria_check') then
    alter table public.marmorarias
      add constraint marmorarias_fator_meia_esquadria_check
      check (fator_meia_esquadria > 0);
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 6) Fichas da semana (uma por pessoa por semana)
-- ──────────────────────────────────────────────────────────────────────
-- Mesmo ritmo da presença: a semana é gerada automaticamente (cron da
-- segunda, ou sob demanda ao abrir a tela) e fechada no fim. Semana
-- fechada vira somente leitura.
create table if not exists public.fichas_producao (
  id uuid primary key default gen_random_uuid(),
  marmoraria_id uuid not null references public.marmorarias(id) on delete cascade,
  pessoa_id uuid not null references public.funcionarios(id) on delete cascade,
  semana_inicio date not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  fechada_em timestamptz,
  fechada_por uuid references public.usuarios(id),
  arquivo_url text,
  created_at timestamptz not null default now(),
  unique (pessoa_id, semana_inicio)
);

create index if not exists fichas_producao_semana_idx
  on public.fichas_producao (marmoraria_id, semana_inicio);

alter table public.fichas_producao enable row level security;

drop policy if exists "fichas_producao_proprio_tenant" on public.fichas_producao;
create policy "fichas_producao_proprio_tenant"
on public.fichas_producao for all
using (marmoraria_id = get_marmoraria_id())
with check (marmoraria_id = get_marmoraria_id());

-- ──────────────────────────────────────────────────────────────────────
-- 7) GRANTs
-- ──────────────────────────────────────────────────────────────────────
-- `producao_apontamentos` ficou sem GRANT por meses e nenhum insert nela
-- jamais funcionou (achado em 29/08); `insumo_reset_log` repetiu o erro.
-- Conceder sempre, junto com a RLS — a policy só é consultada depois que
-- o GRANT de base deixa passar.
grant select, insert, update, delete, references, trigger, truncate
  on table public.fichas_producao
  to anon, authenticated, service_role;

-- Reafirma os GRANTs das tabelas alteradas aqui (idempotente).
grant select, insert, update, delete, references, trigger, truncate
  on table public.producao_apontamentos, public.funcionarios, public.marmorarias
  to anon, authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────
-- 8) Dados iniciais — vínculo das duas pessoas com cadastro duplicado
-- ──────────────────────────────────────────────────────────────────────
-- "Val" (acabador) é o Valdemir (instalador); Ademilson tem um cadastro
-- de cada. Em ambos o cadastro de instalador é o principal, porque é o que
-- carrega o valor por metro linear usado no pagamento.
update public.funcionarios acabador
   set pessoa_id = instalador.id
  from public.funcionarios instalador
 where acabador.cargo = 'acabador'
   and instalador.cargo = 'instalador'
   and instalador.marmoraria_id = acabador.marmoraria_id
   and acabador.pessoa_id is null
   and instalador.pessoa_id is null
   and (
     (lower(acabador.nome) = 'val' and lower(instalador.nome) = 'valdemir')
     or (lower(acabador.nome) = 'ademilson' and lower(instalador.nome) = 'ademilson')
   );

-- Portal do instalador (item 5 do backlog) — Fase 1: schema aditivo.
-- Nenhuma coluna existente é removida ou alterada; apenas novas colunas
-- nullable e ampliação de CHECK constraints. Seguro para as 206 linhas
-- reais de orcamento_itens, 11 de funcionarios e 10 de usuarios já em
-- produção (Real Pedras Marmoraria).

-- 1) Libera o perfil 'instalador' para login restrito.
alter table public.usuarios
  drop constraint usuarios_perfil_check;
alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil = any (array['admin', 'gerente', 'operador', 'instalador']));

-- 2) Liga um funcionário (cadastro de mão de obra) a um usuário (login).
-- Só instaladores com acesso ao portal terão esse campo preenchido.
alter table public.funcionarios
  add column usuario_id uuid references public.usuarios(id);
create unique index funcionarios_usuario_id_key on public.funcionarios(usuario_id)
  where usuario_id is not null;

-- 3) Rastreio de quem instalou cada peça, mesmo padrão de cortado_por/acabado_por.
alter table public.orcamento_itens
  add column instalado_por uuid references public.funcionarios(id),
  add column instalado_em timestamptz;

-- 4) Reaproveita producao_apontamentos para o registro de instalação
-- (etapa='instalacao', origem='manual'), com o fluxo de foto + aprovação.
-- O check de etapa hoje só permite 'corte'/'acabamento' — precisa ampliar.
alter table public.producao_apontamentos
  drop constraint producao_apontamentos_etapa_check;
alter table public.producao_apontamentos
  add constraint producao_apontamentos_etapa_check
  check (etapa = any (array['corte', 'acabamento', 'instalacao']));

alter table public.producao_apontamentos
  add column orcamento_item_id uuid references public.orcamento_itens(id),
  add column foto_storage_path text,
  add column status text not null default 'pendente',
  add column aprovado_por uuid references public.usuarios(id),
  add column aprovado_em timestamptz,
  add column valor_calculado numeric,
  add column obra_nome_avulso text,
  add column obra_local_avulso text,
  add column is_retroativo boolean not null default false;

alter table public.producao_apontamentos
  add constraint producao_apontamentos_status_check
  check (status = any (array['pendente', 'aprovado', 'rejeitado']));

-- Obra avulsa/retroativa: sem orcamento_id, mas com nome+local preenchidos.
-- Obra do sistema: com orcamento_id, sem os campos avulsos.
alter table public.producao_apontamentos
  add constraint producao_apontamentos_retroativo_check
  check (
    (is_retroativo = false and orcamento_id is not null and obra_nome_avulso is null and obra_local_avulso is null)
    or
    (is_retroativo = true and orcamento_id is null and obra_nome_avulso is not null and obra_local_avulso is not null)
  );

comment on column public.producao_apontamentos.valor_calculado is
  'Snapshot de metros_lineares × valor_metro_linear no momento do registro — não recalcula se o cadastro do funcionário mudar depois.';

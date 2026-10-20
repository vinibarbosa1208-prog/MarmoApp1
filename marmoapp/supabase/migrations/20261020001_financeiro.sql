-- Gestão de caixa: contas a receber, contas a pagar, compras programadas e
-- despesas fixas recorrentes (20/10/2026).
--
-- Uma tabela só de lançamentos (`financeiro_lancamentos`), com `tipo`
-- receber/pagar. As fontes que já existiam no sistema alimentam essa tabela
-- sozinhas, por trigger, pra ninguém digitar a mesma coisa duas vezes:
--   • insumo_pedidos          → conta a pagar (valor e status sincronizados)
--   • funcionario_pagamentos  → saída já paga (pagamento/adiantamento)
--   • orcamentos.data_prevista_instalacao → move o vencimento da parcela
--     "saldo na instalação" quando a data de instalação muda
-- Despesas fixas ficam em `financeiro_recorrencias` e viram lançamentos
-- mês a mês pela função `financeiro_gerar_recorrencias`.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Tabelas
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.financeiro_recorrencias (
  id              uuid primary key default gen_random_uuid(),
  marmoraria_id   uuid not null references public.marmorarias(id) on delete cascade,
  descricao       text not null,
  contraparte     text null,
  categoria       text not null default 'despesa_fixa',
  valor           numeric(12,2) not null check (valor > 0),
  dia_vencimento  int not null check (dia_vencimento between 1 and 31),
  inicio          date not null default current_date,
  fim             date null,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.financeiro_lancamentos (
  id                        uuid primary key default gen_random_uuid(),
  marmoraria_id             uuid not null references public.marmorarias(id) on delete cascade,
  tipo                      text not null check (tipo in ('receber','pagar')),
  categoria                 text not null default 'outros',
  descricao                 text not null,
  contraparte               text null,
  valor                     numeric(12,2) not null default 0 check (valor >= 0),
  vencimento                date not null,
  status                    text not null default 'previsto' check (status in ('previsto','pago','cancelado')),
  data_pagamento            date null,
  forma_pagamento           text null,
  observacao                text null,
  origem                    text not null default 'manual'
                            check (origem in ('manual','orcamento','insumo_pedido','funcionario_pagamento','recorrencia','compra_programada')),
  orcamento_id              uuid null references public.orcamentos(id) on delete cascade,
  insumo_pedido_id          uuid null unique references public.insumo_pedidos(id) on delete cascade,
  funcionario_pagamento_id  uuid null unique references public.funcionario_pagamentos(id) on delete cascade,
  recorrencia_id            uuid null references public.financeiro_recorrencias(id) on delete set null,
  competencia               date null,
  acompanha_instalacao      boolean not null default false,
  parcela_num               int null,
  parcela_total             int null,
  sugestao_chave            text null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists financeiro_lanc_recorrencia_competencia_uq
  on public.financeiro_lancamentos(recorrencia_id, competencia) where recorrencia_id is not null;
create index if not exists financeiro_lanc_tenant_venc_idx
  on public.financeiro_lancamentos(marmoraria_id, tipo, vencimento);
create index if not exists financeiro_lanc_orcamento_idx
  on public.financeiro_lancamentos(orcamento_id) where orcamento_id is not null;

-- RLS + grants (as duas coisas — a falta de GRANT já derrubou
-- producao_apontamentos e insumo_reset_log antes).
alter table public.financeiro_lancamentos enable row level security;
alter table public.financeiro_recorrencias enable row level security;

drop policy if exists financeiro_lancamentos_proprio_tenant on public.financeiro_lancamentos;
create policy financeiro_lancamentos_proprio_tenant on public.financeiro_lancamentos
  for all using (marmoraria_id = get_marmoraria_id()) with check (marmoraria_id = get_marmoraria_id());

drop policy if exists financeiro_recorrencias_proprio_tenant on public.financeiro_recorrencias;
create policy financeiro_recorrencias_proprio_tenant on public.financeiro_recorrencias
  for all using (marmoraria_id = get_marmoraria_id()) with check (marmoraria_id = get_marmoraria_id());

grant select, insert, update, delete on public.financeiro_lancamentos  to authenticated, service_role;
grant select, insert, update, delete on public.financeiro_recorrencias to authenticated, service_role;

create or replace function public.financeiro_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_financeiro_lanc_updated_at on public.financeiro_lancamentos;
create trigger trg_financeiro_lanc_updated_at before update on public.financeiro_lancamentos
  for each row execute function public.financeiro_touch_updated_at();
drop trigger if exists trg_financeiro_rec_updated_at on public.financeiro_recorrencias;
create trigger trg_financeiro_rec_updated_at before update on public.financeiro_recorrencias
  for each row execute function public.financeiro_touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 2) Pedido de insumos → conta a pagar
-- ──────────────────────────────────────────────────────────────────────
-- Vencimento inicial = data do pedido; depois o gestor ajusta no
-- Financeiro e a trigger não sobrescreve. Valor e status seguem o pedido
-- (valor_total é recalculado por trigger quando os itens entram).
create or replace function public.financeiro_sync_insumo_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_forn text;
  v_status text;
  v_desc text;
begin
  select nome into v_forn from fornecedoras where id = new.fornecedora_id;
  v_desc := 'Pedido de insumos' || coalesce(' #' || nullif(new.numero_pedido, ''), '');
  v_status := case new.status when 'pago' then 'pago' when 'cancelado' then 'cancelado' else 'previsto' end;

  if tg_op = 'INSERT' then
    insert into financeiro_lancamentos
      (marmoraria_id, tipo, categoria, descricao, contraparte, valor, vencimento, status, data_pagamento, origem, insumo_pedido_id)
    values
      (new.marmoraria_id, 'pagar', 'insumos', v_desc, v_forn, coalesce(new.valor_total, 0),
       coalesce(new.data_pedido, current_date), v_status,
       case when v_status = 'pago' then coalesce(new.data_pagamento, current_date) end,
       'insumo_pedido', new.id)
    on conflict (insumo_pedido_id) do nothing;
  else
    update financeiro_lancamentos set
      valor       = coalesce(new.valor_total, 0),
      descricao   = v_desc,
      contraparte = v_forn,
      status      = case when old.status is distinct from new.status then v_status else status end,
      data_pagamento = case
        when old.status is distinct from new.status and v_status = 'pago' then coalesce(new.data_pagamento, current_date)
        when old.status is distinct from new.status and v_status <> 'pago' then null
        else data_pagamento end
    where insumo_pedido_id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_financeiro_sync_insumo_pedido on public.insumo_pedidos;
create trigger trg_financeiro_sync_insumo_pedido after insert or update on public.insumo_pedidos
  for each row execute function public.financeiro_sync_insumo_pedido();

-- ──────────────────────────────────────────────────────────────────────
-- 3) Pagamento de funcionário/instalador → saída já paga
-- ──────────────────────────────────────────────────────────────────────
-- 'desconto' não é saída de caixa (é abatimento), então não entra.
create or replace function public.financeiro_sync_funcionario_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if tg_op = 'UPDATE' and new.tipo = 'desconto' then
    delete from financeiro_lancamentos where funcionario_pagamento_id = new.id;
    return new;
  end if;
  if new.tipo = 'desconto' then return new; end if;

  select nome into v_nome from funcionarios where id = new.funcionario_id;

  insert into financeiro_lancamentos
    (marmoraria_id, tipo, categoria, descricao, contraparte, valor, vencimento, status, data_pagamento, origem, funcionario_pagamento_id, observacao)
  values
    (new.marmoraria_id, 'pagar', 'equipe',
     case new.tipo when 'adiantamento' then 'Adiantamento (vale)' else 'Pagamento de equipe' end
       || coalesce(' — ' || nullif(new.semana_referencia, ''), ''),
     v_nome, new.valor, coalesce(new.data, current_date), 'pago', coalesce(new.data, current_date),
     'funcionario_pagamento', new.id, new.descricao)
  on conflict (funcionario_pagamento_id) do update set
    valor = excluded.valor, vencimento = excluded.vencimento, data_pagamento = excluded.data_pagamento,
    descricao = excluded.descricao, contraparte = excluded.contraparte, observacao = excluded.observacao;
  return new;
end; $$;

drop trigger if exists trg_financeiro_sync_funcionario_pagamento on public.funcionario_pagamentos;
create trigger trg_financeiro_sync_funcionario_pagamento after insert or update on public.funcionario_pagamentos
  for each row execute function public.financeiro_sync_funcionario_pagamento();

-- ──────────────────────────────────────────────────────────────────────
-- 4) Data de instalação mudou → parcela "saldo na instalação" acompanha
-- ──────────────────────────────────────────────────────────────────────
create or replace function public.financeiro_sync_data_instalacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data_prevista_instalacao is not null
     and new.data_prevista_instalacao is distinct from old.data_prevista_instalacao then
    update financeiro_lancamentos
       set vencimento = new.data_prevista_instalacao
     where orcamento_id = new.id and acompanha_instalacao and status = 'previsto';
  end if;
  return new;
end; $$;

drop trigger if exists trg_financeiro_sync_data_instalacao on public.orcamentos;
create trigger trg_financeiro_sync_data_instalacao after update of data_prevista_instalacao on public.orcamentos
  for each row execute function public.financeiro_sync_data_instalacao();

-- ──────────────────────────────────────────────────────────────────────
-- 5) Despesas fixas → lançamentos do mês (idempotente)
-- ──────────────────────────────────────────────────────────────────────
create or replace function public.financeiro_gerar_recorrencias(p_marmoraria_id uuid, p_ate date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  m date;
  v_venc date;
  v_n int := 0;
  v_rows int;
begin
  for r in select * from financeiro_recorrencias where marmoraria_id = p_marmoraria_id and ativo loop
    m := greatest(date_trunc('month', r.inicio), date_trunc('month', current_date))::date;
    while m <= date_trunc('month', p_ate)::date and (r.fim is null or m <= r.fim) loop
      v_venc := m + (least(r.dia_vencimento, extract(day from (m + interval '1 month - 1 day'))::int) - 1);
      insert into financeiro_lancamentos
        (marmoraria_id, tipo, categoria, descricao, contraparte, valor, vencimento, origem, recorrencia_id, competencia)
      values
        (r.marmoraria_id, 'pagar', r.categoria, r.descricao, r.contraparte, r.valor, v_venc, 'recorrencia', r.id, m)
      on conflict (recorrencia_id, competencia) where recorrencia_id is not null do nothing;
      get diagnostics v_rows = row_count;
      v_n := v_n + v_rows;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;
  return v_n;
end; $$;

revoke all on function public.financeiro_gerar_recorrencias(uuid, date) from public, anon;
grant execute on function public.financeiro_gerar_recorrencias(uuid, date) to service_role;

-- ──────────────────────────────────────────────────────────────────────
-- 6) Backfill do que já existe
-- ──────────────────────────────────────────────────────────────────────
insert into public.financeiro_lancamentos
  (marmoraria_id, tipo, categoria, descricao, contraparte, valor, vencimento, status, data_pagamento, origem, insumo_pedido_id)
select p.marmoraria_id, 'pagar', 'insumos',
       'Pedido de insumos' || coalesce(' #' || nullif(p.numero_pedido, ''), ''),
       f.nome, coalesce(p.valor_total, 0), coalesce(p.data_pedido, p.created_at::date),
       case p.status when 'pago' then 'pago' when 'cancelado' then 'cancelado' else 'previsto' end,
       case when p.status = 'pago' then coalesce(p.data_pagamento, p.updated_at::date) end,
       'insumo_pedido', p.id
from public.insumo_pedidos p
left join public.fornecedoras f on f.id = p.fornecedora_id
on conflict (insumo_pedido_id) do nothing;

insert into public.financeiro_lancamentos
  (marmoraria_id, tipo, categoria, descricao, contraparte, valor, vencimento, status, data_pagamento, origem, funcionario_pagamento_id, observacao)
select fp.marmoraria_id, 'pagar', 'equipe',
       case fp.tipo when 'adiantamento' then 'Adiantamento (vale)' else 'Pagamento de equipe' end
         || coalesce(' — ' || nullif(fp.semana_referencia, ''), ''),
       fu.nome, fp.valor, coalesce(fp.data, fp.created_at::date), 'pago', coalesce(fp.data, fp.created_at::date),
       'funcionario_pagamento', fp.id, fp.descricao
from public.funcionario_pagamentos fp
left join public.funcionarios fu on fu.id = fp.funcionario_id
where fp.tipo <> 'desconto' and fp.marmoraria_id is not null
on conflict (funcionario_pagamento_id) do nothing;

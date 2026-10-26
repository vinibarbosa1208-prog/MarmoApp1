-- Pia Programada (26/10/2026)
--
-- Compra programada de pia: o cliente escolhe um kit pronto (4 opções),
-- paga parcelas mensais pequenas e a pia só entra em produção quando
-- 100% está pago (sem risco de inadimplência). Pode antecipar ou quitar
-- o saldo a qualquer momento pelo portal do cliente (/minha-pia).
--
-- O cliente final NÃO é um `usuarios` do sistema — ele entra com CPF + PIN
-- e as rotas públicas usam a service key, sempre filtrando pela adesão da
-- sessão. Por isso as tabelas têm RLS só com a policy do tenant (gestor).
--
-- O dinheiro das parcelas é do cliente até a pia ser entregue: não entra
-- em financeiro_lancamentos como receita (fica de fora de propósito).

-- ──────────────────────────────────────────────────────────────────────
-- 1) Configuração por marmoraria
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_config (
  marmoraria_id        uuid primary key references public.marmorarias(id) on delete cascade,
  ativo                boolean not null default true,
  nome_programa        text not null default 'Pia Programada',
  prazo_entrega_dias   int not null default 20 check (prazo_entrega_dias between 1 and 180),
  cidades_atendidas    text[] not null default '{}',
  parcelas_opcoes      numeric(12,2)[] not null default '{150,200,250,300}',
  whatsapp_contato     text null,
  pix_chave            text null,   -- usada quando o Asaas não está configurado
  pix_favorecido       text null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 2) Kits (modelo pronto do que a pessoa leva)
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_kits (
  id              uuid primary key default gen_random_uuid(),
  marmoraria_id   uuid not null references public.marmorarias(id) on delete cascade,
  codigo          text not null,
  nome            text not null,
  grupo           text not null check (grupo in ('medio','alto')),
  material_nome   text not null,
  tom             text not null check (tom in ('clara','escura')),
  comprimento_m   numeric(6,2) not null default 2.5,
  descricao       text null,
  inclui          text[] not null default '{}',
  preco_total     numeric(12,2) not null check (preco_total > 0),
  custo_base      numeric(12,2) not null default 0 check (custo_base >= 0), -- ao atingir, libera oferta de antecipação
  ordem           int not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (marmoraria_id, codigo)
);

-- ──────────────────────────────────────────────────────────────────────
-- 3) Adesões (um cliente + um kit)
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_adesoes (
  id                        uuid primary key default gen_random_uuid(),
  marmoraria_id             uuid not null references public.marmorarias(id) on delete cascade,
  numero                    serial,
  kit_id                    uuid not null references public.programado_kits(id),
  cliente_id                uuid null references public.clientes(id) on delete set null,
  -- dados congelados no momento da adesão
  kit_nome                  text not null,
  valor_total               numeric(12,2) not null check (valor_total > 0),
  valor_parcela             numeric(12,2) not null check (valor_parcela > 0),
  dia_vencimento            int not null check (dia_vencimento between 1 and 28),
  -- cliente
  nome                      text not null,
  cpf                       text not null,  -- só dígitos
  whatsapp                  text not null,  -- só dígitos
  email                     text null,
  cep                       text null,
  endereco                  text null,
  numero_endereco           text null,
  complemento               text null,
  bairro                    text null,
  cidade                    text not null,
  -- acesso
  pin_hash                  text not null,
  pin_tentativas            int not null default 0,
  pin_bloqueado_ate         timestamptz null,
  -- andamento
  status                    text not null default 'aguardando_pagamento' check (status in (
                              'aguardando_pagamento','ativa','pausada','quitada','medicao_agendada',
                              'em_producao','instalacao_agendada','instalada','cancelada')),
  total_pago                numeric(12,2) not null default 0,
  desconto                  numeric(12,2) not null default 0,
  quitada_em                timestamptz null,
  medicao_data              date null,
  instalacao_data           date null,
  instalada_em              timestamptz null,
  cancelada_em              timestamptz null,
  -- ofertas
  antecipacao_solicitada_em timestamptz null,
  oferta_quitacao_valor     numeric(12,2) null,   -- valor para quitar o saldo hoje (com desconto)
  oferta_validade           date null,
  oferta_mensagem           text null,
  -- integrações / marketing
  asaas_customer_id         text null,
  utm_source                text null,
  utm_medium                text null,
  utm_campaign              text null,
  utm_content               text null,
  fbclid                    text null,
  aceite_termos_em          timestamptz not null default now(),
  observacao_interna        text null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Um CPF só pode ter uma adesão em andamento por marmoraria.
create unique index if not exists programado_adesoes_cpf_ativo_uq
  on public.programado_adesoes(marmoraria_id, cpf)
  where status not in ('instalada','cancelada');
create index if not exists programado_adesoes_tenant_status_idx
  on public.programado_adesoes(marmoraria_id, status);

-- ──────────────────────────────────────────────────────────────────────
-- 4) Pagamentos (cobranças geradas + recebidas)
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  marmoraria_id       uuid not null references public.marmorarias(id) on delete cascade,
  adesao_id           uuid not null references public.programado_adesoes(id) on delete cascade,
  tipo                text not null check (tipo in ('parcela','antecipacao','quitacao','ajuste')),
  valor               numeric(12,2) not null check (valor > 0),
  desconto_aplicado   numeric(12,2) not null default 0,
  vencimento          date not null default current_date,
  status              text not null default 'pendente' check (status in ('pendente','pago','cancelado','expirado')),
  forma               text not null default 'pix' check (forma in ('pix','boleto','manual','dinheiro','cartao')),
  pago_em             timestamptz null,
  registrado_por      uuid null,  -- usuarios.id quando baixa manual
  asaas_payment_id    text null unique,
  pix_copia_cola      text null,
  pix_qr_base64       text null,
  invoice_url         text null,
  observacao          text null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists programado_pag_adesao_idx on public.programado_pagamentos(adesao_id, status);

-- ──────────────────────────────────────────────────────────────────────
-- 5) Sessões do cliente (cookie httpOnly → hash aqui)
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_sessoes (
  token_hash   text primary key,
  adesao_id    uuid not null references public.programado_adesoes(id) on delete cascade,
  expira_em    timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists programado_sessoes_adesao_idx on public.programado_sessoes(adesao_id);

-- ──────────────────────────────────────────────────────────────────────
-- 6) Lista de espera (cidade fora da área de atendimento)
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.programado_lista_espera (
  id             uuid primary key default gen_random_uuid(),
  marmoraria_id  uuid not null references public.marmorarias(id) on delete cascade,
  nome           text not null,
  whatsapp       text not null,
  cidade         text not null,
  kit_codigo     text null,
  utm_source     text null,
  utm_campaign   text null,
  created_at     timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 7) RLS + grants (só o gestor do tenant; rotas públicas usam service key)
-- ──────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['programado_config','programado_kits','programado_adesoes',
                           'programado_pagamentos','programado_lista_espera'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprio_tenant', t);
    execute format('create policy %I on public.%I for all using (marmoraria_id = get_marmoraria_id()) with check (marmoraria_id = get_marmoraria_id())',
                   t || '_proprio_tenant', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- Sessões: ninguém via anon/authenticated; só service_role.
alter table public.programado_sessoes enable row level security;
grant select, insert, update, delete on public.programado_sessoes to service_role;
grant usage, select on sequence public.programado_adesoes_numero_seq to authenticated, service_role;

-- pin_hash: as rotas do gestor sempre selecionam colunas explícitas (nunca '*').

do $$
declare t text;
begin
  foreach t in array array['programado_config','programado_kits','programado_adesoes','programado_pagamentos'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.financeiro_touch_updated_at()',
                   'trg_' || t || '_updated_at', t);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- 8) Recalcular total pago e status (chamada após cada pagamento)
-- ──────────────────────────────────────────────────────────────────────
create or replace function public.programado_recalcular(p_adesao_id uuid)
returns public.programado_adesoes
language plpgsql security definer set search_path = public as $$
declare
  a public.programado_adesoes;
  v_pago numeric(12,2);
  v_desc numeric(12,2);
begin
  select coalesce(sum(valor), 0), coalesce(sum(desconto_aplicado), 0)
    into v_pago, v_desc
    from programado_pagamentos
   where adesao_id = p_adesao_id and status = 'pago';

  update programado_adesoes set
    total_pago = v_pago,
    desconto   = v_desc,
    status = case
      when status in ('aguardando_pagamento','ativa','pausada') and v_pago + v_desc >= valor_total then 'quitada'
      when status = 'aguardando_pagamento' and v_pago > 0 then 'ativa'
      else status end,
    quitada_em = case
      when quitada_em is null and v_pago + v_desc >= valor_total then now()
      else quitada_em end
  where id = p_adesao_id
  returning * into a;
  return a;
end; $$;

revoke all on function public.programado_recalcular(uuid) from public, anon;
grant execute on function public.programado_recalcular(uuid) to service_role;

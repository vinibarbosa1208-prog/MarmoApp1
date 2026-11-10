-- MarmorarIA: contratos gerados no painel e assinados por aceite eletrônico.
-- Assinatura eletrônica simples entre particulares (MP 2.200-2/2001, art. 10, § 2º):
-- o texto é congelado no envio, com hash SHA-256; a assinatura guarda quem assinou
-- (nome, CPF, e-mail confirmado por código), quando, de onde (IP, navegador) e o hash
-- do texto aceito. Só o painel admin (service role) lê e grava.

create sequence if not exists public.contratos_numero_seq;

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique
    default ('MIA-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' ||
             lpad(nextval('public.contratos_numero_seq')::text, 4, '0')),
  lead_id uuid references public.leads(id) on delete set null,
  diagnostico_id uuid references public.diagnosticos(id) on delete set null,

  -- O que foi contratado
  plano text not null check (plano in ('gestao', 'operacao', 'crescimento')),
  condicao text not null check (condicao in ('fundador', 'tabela')),
  mensalidade numeric(12,2) not null check (mensalidade >= 0),
  implantacao numeric(12,2) not null check (implantacao >= 0),
  valor_por_medicao numeric(12,2),
  fidelidade_meses integer not null default 0,
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  data_ativacao_antonio date,
  mensalidade_ate_ativacao numeric(12,2),
  primeira_cobranca numeric(12,2) not null check (primeira_cobranca >= 0),

  -- Partes (como aparecem no contrato)
  contratante jsonb not null,
  contratada jsonb not null,

  -- Texto congelado no envio
  versao_modelo text not null,
  texto text,
  hash_sha256 text,

  -- Link de assinatura e código de verificação
  token text unique,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'assinado', 'cancelado')),
  enviado_em timestamptz,
  otp_hash text,
  otp_expira_em timestamptz,
  otp_tentativas integer not null default 0,
  otp_envios integer not null default 0,

  -- Registro da assinatura (trilha de auditoria)
  assinado_em timestamptz,
  assinatura jsonb,
  cancelado_em timestamptz,
  motivo_cancelamento text,

  -- Cobrança da 1ª mensalidade (Asaas)
  asaas_customer_id text,
  asaas_payment_id text,
  link_pagamento text,

  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contratos_lead_id_idx on public.contratos (lead_id);
create index if not exists contratos_status_idx on public.contratos (status, updated_at desc);

alter table public.contratos enable row level security;
drop policy if exists "contratos: apenas service role acessa" on public.contratos;
create policy "contratos: apenas service role acessa" on public.contratos
  for all using (false);

-- O texto e o hash não mudam depois do envio.
create or replace function public.contratos_texto_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'rascunho' and (
       new.texto is distinct from old.texto
    or new.hash_sha256 is distinct from old.hash_sha256
    or new.contratante is distinct from old.contratante
    or new.contratada is distinct from old.contratada
    or new.mensalidade is distinct from old.mensalidade
    or new.implantacao is distinct from old.implantacao
    or new.plano is distinct from old.plano
  ) then
    raise exception 'Contrato % já foi enviado: o texto não pode ser alterado. Cancele e gere outro.', old.numero;
  end if;
  if old.status = 'assinado' and new.assinatura is distinct from old.assinatura then
    raise exception 'Contrato % já foi assinado: o registro da assinatura não pode ser alterado.', old.numero;
  end if;
  return new;
end;
$$;

drop trigger if exists contratos_texto_imutavel on public.contratos;
create trigger contratos_texto_imutavel
  before update on public.contratos
  for each row execute function public.contratos_texto_imutavel();

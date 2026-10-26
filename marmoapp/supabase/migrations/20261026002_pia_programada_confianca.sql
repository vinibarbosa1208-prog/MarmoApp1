-- Pia Programada — dados de confiança e fotos do site (26/10/2026)
alter table public.programado_config
  add column if not exists cnpj               text null,
  add column if not exists fundada_ano        int  null check (fundada_ano between 1900 and 2100),
  add column if not exists garantia_meses     int  null check (garantia_meses between 1 and 120),
  add column if not exists instagram          text null,
  add column if not exists horario_atendimento text null,
  -- [{ "path": "...", "url": "...", "legenda": "...", "destaque": true }]
  add column if not exists fotos              jsonb not null default '[]'::jsonb;

-- Bucket público: são fotos de obras para o site. Upload/remoção só pela
-- rota /api/programado/fotos (service role), restrita ao gestor.
insert into storage.buckets (id, name, public)
values ('programado-fotos', 'programado-fotos', true)
on conflict (id) do nothing;

-- Publicação automática no Instagram (@marmoapp.oficial) pelo painel interno.
-- Um post só sai se estiver "aprovado"; o cron (pg_cron a cada 5 min) chama
-- /api/cron/instagram, que cria o contêiner na API do Instagram e publica quando ele fica pronto.
create table if not exists public.admin_ig_posts (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'reels' check (tipo in ('reels', 'story', 'imagem')),
  titulo text not null,
  midia_url text not null,
  capa_url text,
  legenda text not null default '',
  publicar_em timestamptz not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aprovado', 'publicando', 'publicado', 'erro', 'cancelado')),
  container_id text,
  ig_media_id text,
  permalink text,
  erro text,
  tentativas integer not null default 0,
  aprovado_em timestamptz,
  aprovado_por text,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_ig_posts enable row level security;
grant select, insert, update, delete on table public.admin_ig_posts to service_role;
create index if not exists admin_ig_posts_fila_idx on public.admin_ig_posts (status, publicar_em);

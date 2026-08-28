-- Portal do instalador — bucket privado para fotos de comprovação de instalação.
-- Convenção de path: {marmoraria_id}/{funcionario_id}/{apontamento_id}.jpg
-- Leitura/escrita real acontece via rotas /api/* com service role (mesmo
-- padrão já usado no resto do app — RLS aqui é defesa em profundidade).

insert into storage.buckets (id, name, public)
values ('comprovantes-instalacao', 'comprovantes-instalacao', false)
on conflict (id) do nothing;

create policy "portal_instalador_insere_propria_foto"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprovantes-instalacao'
  and (storage.foldername(name))[1] = (select marmoraria_id::text from public.usuarios where id = auth.uid())
  and (
    exists (select 1 from public.usuarios u where u.id = auth.uid() and u.perfil in ('admin', 'gerente'))
    or exists (select 1 from public.funcionarios f where f.usuario_id = auth.uid() and f.id::text = (storage.foldername(name))[2])
  )
);

create policy "portal_instalador_le_propria_foto_ou_gestor"
on storage.objects for select to authenticated
using (
  bucket_id = 'comprovantes-instalacao'
  and (storage.foldername(name))[1] = (select marmoraria_id::text from public.usuarios where id = auth.uid())
  and (
    exists (select 1 from public.usuarios u where u.id = auth.uid() and u.perfil in ('admin', 'gerente'))
    or exists (select 1 from public.funcionarios f where f.usuario_id = auth.uid() and f.id::text = (storage.foldername(name))[2])
  )
);

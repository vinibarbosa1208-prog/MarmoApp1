-- Bucket privado pra foto/scan da ficha de papel (upload opcional, serve de
-- prova se houver dúvida depois sobre o que estava escrito na folha).
--
-- Convenção de path: {marmoraria_id}/{semana_inicio}/{pessoa_id}-{ts}.{ext}
-- Leitura e escrita acontecem só via /api/producao/fichas/arquivo com
-- service role (mesmo padrão de comprovantes-instalacao) — a RLS abaixo é
-- defesa em profundidade, não o caminho principal.

insert into storage.buckets (id, name, public)
values ('fichas-producao', 'fichas-producao', false)
on conflict (id) do nothing;

drop policy if exists "fichas_producao_gestor_insere" on storage.objects;
create policy "fichas_producao_gestor_insere"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fichas-producao'
  and (storage.foldername(name))[1] = (select marmoraria_id::text from public.usuarios where id = auth.uid())
  and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.perfil in ('admin', 'gerente'))
);

drop policy if exists "fichas_producao_gestor_le" on storage.objects;
create policy "fichas_producao_gestor_le"
on storage.objects for select to authenticated
using (
  bucket_id = 'fichas-producao'
  and (storage.foldername(name))[1] = (select marmoraria_id::text from public.usuarios where id = auth.uid())
  and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.perfil in ('admin', 'gerente'))
);

-- Substituição do arquivo da semana apaga o antigo depois de apontar o novo.
drop policy if exists "fichas_producao_gestor_remove" on storage.objects;
create policy "fichas_producao_gestor_remove"
on storage.objects for delete to authenticated
using (
  bucket_id = 'fichas-producao'
  and (storage.foldername(name))[1] = (select marmoraria_id::text from public.usuarios where id = auth.uid())
  and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.perfil in ('admin', 'gerente'))
);

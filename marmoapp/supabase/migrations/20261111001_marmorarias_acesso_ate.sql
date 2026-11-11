-- Corte de acesso definido pelo time MarmoApp (ex.: teste da PoliArte até 18/11/2026).
-- Passou a data, o sistema mostra /acesso-encerrado. Nulo = sem corte (todas as contas atuais).
alter table public.marmorarias add column if not exists acesso_ate timestamptz;

-- Os usuários das marmorarias podem atualizar a própria linha (policy marmorarias_update),
-- então só o painel interno (service role) ou o banco podem mudar este campo.
create or replace function public.marmorarias_protege_acesso_ate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.acesso_ate := null;
    else
      new.acesso_ate := old.acesso_ate;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists marmorarias_protege_acesso_ate on public.marmorarias;
create trigger marmorarias_protege_acesso_ate
  before insert or update on public.marmorarias
  for each row execute function public.marmorarias_protege_acesso_ate();

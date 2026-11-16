-- Assinatura do plano MarmoApp pelo Asaas (Pix, boleto ou cartão).
alter table public.marmorarias add column if not exists asaas_customer_id text;
alter table public.marmorarias add column if not exists asaas_subscription_id text;
create index if not exists marmorarias_asaas_subscription_idx on public.marmorarias (asaas_subscription_id);

-- Os usuários podem atualizar a própria marmoraria (policy marmorarias_update). Os campos de
-- acesso e pagamento só mudam pelo servidor (service role): webhook do Asaas/Stripe e painel interno.
create or replace function public.marmorarias_protege_acesso_ate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.acesso_ate := null;
      new.trial_expira := null;
      new.asaas_customer_id := null;
      new.asaas_subscription_id := null;
    else
      new.acesso_ate := old.acesso_ate;
      new.trial_expira := old.trial_expira;
      new.plano := old.plano;
      new.asaas_customer_id := old.asaas_customer_id;
      new.asaas_subscription_id := old.asaas_subscription_id;
    end if;
  end if;
  return new;
end;
$$;

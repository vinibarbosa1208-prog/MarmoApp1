-- Migration: adiciona 'medidor' como cargo formal em funcionarios
-- Applied: 2026-08-27
-- Contexto: agenda por profissional (visao dedicada pra medidores) exige um
-- cargo proprio, distinto de 'instalador' -- decisao confirmada com o cliente
-- (nao segmentar so por agenda_event_types, ja que a mesma pessoa pode nao
-- fazer as duas coisas e o cargo da identidade profissional dedicada).

ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_cargo_check;

ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_cargo_check
  CHECK (cargo = ANY (ARRAY['serrador'::text, 'acabador'::text, 'instalador'::text, 'medidor'::text, 'outro'::text]));

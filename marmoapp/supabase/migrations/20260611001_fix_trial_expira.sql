-- Corrigir marmorarias em trial com data absurda (ex: 2099-12-31)
UPDATE marmorarias
SET trial_expira = now() + interval '7 days'
WHERE plano = 'trial'
  AND trial_expira > now() + interval '365 days';

-- Alterar default da coluna de 30 para 7 dias
ALTER TABLE marmorarias
ALTER COLUMN trial_expira SET DEFAULT now() + interval '7 days';

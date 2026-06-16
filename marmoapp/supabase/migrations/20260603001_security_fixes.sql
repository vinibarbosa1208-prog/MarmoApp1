ALTER TABLE public.marmorarias
  ADD COLUMN IF NOT EXISTS evolution_instance_name text UNIQUE;

CREATE INDEX IF NOT EXISTS marmorarias_evolution_instance_idx
  ON public.marmorarias(evolution_instance_name)
  WHERE evolution_instance_name IS NOT NULL;

ALTER TABLE public.marmorarias
  ADD COLUMN IF NOT EXISTS setup_concluido boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.marmorarias.evolution_instance_name IS
  'Nome exato da instância Evolution API para matching seguro no webhook do Antônio.';

COMMENT ON COLUMN public.marmorarias.setup_concluido IS
  'Flag que indica se o seed de dados padrão já foi executado para esta marmoraria.';

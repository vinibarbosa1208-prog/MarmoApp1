-- Tabela de logs de erro capturados pelo app principal
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text,
  error_message text,
  error_stack text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marmoraria_id uuid REFERENCES public.marmorarias(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_idx ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_marmoraria_idx ON public.error_logs(marmoraria_id, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode acessar (leitura pelo admin via supabaseAdmin)
CREATE POLICY "error_logs: apenas service role acessa"
  ON public.error_logs FOR ALL
  USING (false);

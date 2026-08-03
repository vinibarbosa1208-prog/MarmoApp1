-- Tabela de administradores do painel
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nome text NOT NULL,
  nivel text NOT NULL DEFAULT 'admin' CHECK (nivel IN ('super_admin', 'admin', 'viewer')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users: apenas service role acessa"
  ON public.admin_users FOR ALL
  USING (false);

-- Tabela de logs do sistema para o monitor de erros
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('erro', 'aviso', 'info')),
  rota text,
  mensagem text NOT NULL,
  detalhes jsonb,
  marmoraria_id uuid REFERENCES public.marmorarias(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_logs_tipo_idx ON public.admin_logs(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON public.admin_logs(created_at DESC);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_logs: apenas service role acessa"
  ON public.admin_logs FOR ALL
  USING (false);

-- Inserir o primeiro admin (substituir o email pelo real depois)
INSERT INTO public.admin_users (email, nome, nivel)
VALUES ('SEU_EMAIL_AQUI', 'Vinicius', 'super_admin')
ON CONFLICT (email) DO NOTHING;

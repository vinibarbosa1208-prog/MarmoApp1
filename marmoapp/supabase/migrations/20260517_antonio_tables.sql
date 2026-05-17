-- Migration: Antonio Agent Tables
-- Applied: 2026-05-17
-- Description: Add owner_id to marmorarias, create antonio_sessions,
--              antonio_messages, antonio_quotes, antonio_audio_logs

-- ══════════════════════════════════════════════
-- 1. Add owner_id to marmorarias
-- ══════════════════════════════════════════════
ALTER TABLE public.marmorarias
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.marmorarias m
  SET owner_id = u.id
  FROM public.usuarios u
  WHERE u.marmoraria_id = m.id;

-- ══════════════════════════════════════════════
-- 2. Helper trigger function
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ══════════════════════════════════════════════
-- 3. antonio_sessions
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.antonio_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  canal         text NOT NULL DEFAULT 'web',
  phone         text,
  status        text NOT NULL DEFAULT 'ativa',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS antonio_sessions_marmoraria_idx ON public.antonio_sessions(marmoraria_id);
CREATE INDEX IF NOT EXISTS antonio_sessions_phone_idx ON public.antonio_sessions(phone) WHERE phone IS NOT NULL;
ALTER TABLE public.antonio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marmoraria pode ver suas sessoes"
  ON public.antonio_sessions FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

DROP TRIGGER IF EXISTS antonio_sessions_updated_at ON public.antonio_sessions;
CREATE TRIGGER antonio_sessions_updated_at
  BEFORE UPDATE ON public.antonio_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- 4. antonio_messages
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.antonio_messages (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES public.antonio_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  tokens     integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS antonio_messages_session_idx ON public.antonio_messages(session_id);
CREATE INDEX IF NOT EXISTS antonio_messages_created_idx ON public.antonio_messages(session_id, created_at);
ALTER TABLE public.antonio_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marmoraria pode ver suas mensagens"
  ON public.antonio_messages FOR ALL
  USING (session_id IN (
    SELECT s.id FROM public.antonio_sessions s
    JOIN public.usuarios u ON u.marmoraria_id = s.marmoraria_id
    WHERE u.id = auth.uid()
  ));

-- ══════════════════════════════════════════════
-- 5. antonio_quotes
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.antonio_quotes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    uuid REFERENCES public.antonio_sessions(id) ON DELETE SET NULL,
  orcamento_id  uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  marmoraria_id uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  input_text    text,
  raw_json      jsonb,
  status        text NOT NULL DEFAULT 'criado',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS antonio_quotes_marmoraria_idx ON public.antonio_quotes(marmoraria_id);
CREATE INDEX IF NOT EXISTS antonio_quotes_orcamento_idx ON public.antonio_quotes(orcamento_id) WHERE orcamento_id IS NOT NULL;
ALTER TABLE public.antonio_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marmoraria pode ver seus quotes"
  ON public.antonio_quotes FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

DROP TRIGGER IF EXISTS antonio_quotes_updated_at ON public.antonio_quotes;
CREATE TRIGGER antonio_quotes_updated_at
  BEFORE UPDATE ON public.antonio_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- 6. antonio_audio_logs
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.antonio_audio_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id   uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES public.antonio_sessions(id) ON DELETE SET NULL,
  duracao_s       numeric,
  texto_original  text,
  texto_final     text,
  model           text DEFAULT 'whisper-1',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS antonio_audio_logs_marmoraria_idx ON public.antonio_audio_logs(marmoraria_id);
ALTER TABLE public.antonio_audio_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marmoraria pode ver seus audio logs"
  ON public.antonio_audio_logs FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

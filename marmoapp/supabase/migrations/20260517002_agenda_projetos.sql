-- Migration: Agenda Semanal + Gestão de Projetos com Margem
-- Applied: 2026-05-17
-- Note: set_updated_at() already exists from previous migration

-- ══════════════════════════════════════════════
-- 1. agenda_event_types
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_event_types (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  cor           text NOT NULL DEFAULT '#C9A84C',
  icone         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_event_types_marmoraria_idx
  ON public.agenda_event_types(marmoraria_id);

ALTER TABLE public.agenda_event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_event_types: marmoraria acessa seus tipos"
  ON public.agenda_event_types FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

-- ══════════════════════════════════════════════
-- 2. agenda_events
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id   uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  tipo_id         uuid REFERENCES public.agenda_event_types(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descricao       text,
  data_inicio     timestamptz NOT NULL,
  data_fim        timestamptz,
  dia_inteiro     boolean NOT NULL DEFAULT false,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  orcamento_id    uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  responsavel_id  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'agendado'
                  CHECK (status IN ('agendado', 'concluido', 'cancelado')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_events_marmoraria_idx
  ON public.agenda_events(marmoraria_id);
CREATE INDEX IF NOT EXISTS agenda_events_data_inicio_idx
  ON public.agenda_events(marmoraria_id, data_inicio);
CREATE INDEX IF NOT EXISTS agenda_events_cliente_idx
  ON public.agenda_events(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agenda_events_status_idx
  ON public.agenda_events(marmoraria_id, status);

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_events: marmoraria acessa seus eventos"
  ON public.agenda_events FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

DROP TRIGGER IF EXISTS agenda_events_updated_at ON public.agenda_events;
CREATE TRIGGER agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- 3. agenda_assignments
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_assignments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS agenda_assignments_event_idx
  ON public.agenda_assignments(event_id);
CREATE INDEX IF NOT EXISTS agenda_assignments_user_idx
  ON public.agenda_assignments(user_id);

ALTER TABLE public.agenda_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_assignments: marmoraria acessa seus assignments"
  ON public.agenda_assignments FOR ALL
  USING (event_id IN (
    SELECT e.id FROM public.agenda_events e
    JOIN public.usuarios u ON u.marmoraria_id = e.marmoraria_id
    WHERE u.id = auth.uid()
  ));

-- ══════════════════════════════════════════════
-- 4. projects
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id   uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  orcamento_id    uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome            text NOT NULL,
  descricao       text,
  valor_venda     numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
  data_inicio     date,
  data_conclusao  date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_marmoraria_idx
  ON public.projects(marmoraria_id);
CREATE INDEX IF NOT EXISTS projects_status_idx
  ON public.projects(marmoraria_id, status);
CREATE INDEX IF NOT EXISTS projects_cliente_idx
  ON public.projects(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_orcamento_idx
  ON public.projects(orcamento_id) WHERE orcamento_id IS NOT NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: marmoraria acessa seus projetos"
  ON public.projects FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- 5. project_cost_types
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_cost_types (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marmoraria_id uuid NOT NULL REFERENCES public.marmorarias(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  cor           text NOT NULL DEFAULT '#888888',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_cost_types_marmoraria_idx
  ON public.project_cost_types(marmoraria_id);

ALTER TABLE public.project_cost_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_cost_types: marmoraria acessa seus tipos"
  ON public.project_cost_types FOR ALL
  USING (marmoraria_id IN (
    SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
  ));

-- ══════════════════════════════════════════════
-- 6. project_costs
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_costs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo_id     uuid REFERENCES public.project_cost_types(id) ON DELETE SET NULL,
  descricao   text NOT NULL,
  valor       numeric(14,2) NOT NULL DEFAULT 0,
  data        date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_costs_project_idx
  ON public.project_costs(project_id);
CREATE INDEX IF NOT EXISTS project_costs_tipo_idx
  ON public.project_costs(tipo_id) WHERE tipo_id IS NOT NULL;

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_costs: marmoraria acessa seus custos"
  ON public.project_costs FOR ALL
  USING (project_id IN (
    SELECT p.id FROM public.projects p
    JOIN public.usuarios u ON u.marmoraria_id = p.marmoraria_id
    WHERE u.id = auth.uid()
  ));

DROP TRIGGER IF EXISTS project_costs_updated_at ON public.project_costs;
CREATE TRIGGER project_costs_updated_at
  BEFORE UPDATE ON public.project_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

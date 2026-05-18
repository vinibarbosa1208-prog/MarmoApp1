-- ============================================================
-- CONFIGURAÇÕES: status personalizados, campos extras de cliente
-- ============================================================

-- project_custom_statuses
CREATE TABLE IF NOT EXISTS project_custom_statuses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id UUID      NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  cor         TEXT        NOT NULL DEFAULT '#888888',
  ordem       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_custom_statuses_marmoraria
  ON project_custom_statuses(marmoraria_id);

ALTER TABLE project_custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_custom_statuses: marmoraria acessa seus status"
  ON project_custom_statuses
  USING (
    marmoraria_id IN (
      SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- client_custom_fields
CREATE TABLE IF NOT EXISTS client_custom_fields (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id UUID        NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('texto', 'numero', 'data', 'booleano')),
  obrigatorio   BOOLEAN     NOT NULL DEFAULT false,
  ordem         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_custom_fields_marmoraria
  ON client_custom_fields(marmoraria_id);

ALTER TABLE client_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_custom_fields: marmoraria acessa seus campos"
  ON client_custom_fields
  USING (
    marmoraria_id IN (
      SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- client_custom_field_values
CREATE TABLE IF NOT EXISTS client_custom_field_values (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID        NOT NULL REFERENCES client_custom_fields(id) ON DELETE CASCADE,
  cliente_id  UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  valor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(field_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_client_custom_field_values_field
  ON client_custom_field_values(field_id);

CREATE INDEX IF NOT EXISTS idx_client_custom_field_values_cliente
  ON client_custom_field_values(cliente_id);

ALTER TABLE client_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_custom_field_values: acessa via campo da marmoraria"
  ON client_custom_field_values
  USING (
    field_id IN (
      SELECT id FROM client_custom_fields
      WHERE marmoraria_id IN (
        SELECT marmoraria_id FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

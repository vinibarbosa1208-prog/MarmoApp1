-- Colunas de peça técnica e acabamentos nos itens de orçamento
ALTER TABLE orcamento_itens
  ADD COLUMN IF NOT EXISTS tipo_peca          TEXT,
  ADD COLUMN IF NOT EXISTS acabamento_esquerda TEXT,
  ADD COLUMN IF NOT EXISTS acabamento_direita  TEXT,
  ADD COLUMN IF NOT EXISTS acabamento_frente   TEXT,
  ADD COLUMN IF NOT EXISTS acabamento_fundo    TEXT,
  ADD COLUMN IF NOT EXISTS tem_saia            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS altura_saia         NUMERIC,
  ADD COLUMN IF NOT EXISTS tem_frontao         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS altura_frontao      NUMERIC,
  ADD COLUMN IF NOT EXISTS dados_extras        JSONB;

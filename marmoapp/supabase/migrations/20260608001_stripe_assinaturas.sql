-- Adicionar colunas Stripe que ainda NÃO existem na tabela assinaturas
ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS cancelar_no_fim BOOLEAN DEFAULT false;

-- UNIQUE constraint em stripe_sub_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assinaturas_stripe_sub_id_key' AND conrelid = 'assinaturas'::regclass
  ) THEN
    ALTER TABLE assinaturas ADD CONSTRAINT assinaturas_stripe_sub_id_key UNIQUE (stripe_sub_id);
  END IF;
END$$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_marmoraria  ON assinaturas(marmoraria_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_cust ON assinaturas(stripe_customer);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_sub  ON assinaturas(stripe_sub_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_assinaturas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assinaturas_updated_at ON assinaturas;
CREATE TRIGGER trg_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW EXECUTE FUNCTION update_assinaturas_updated_at();

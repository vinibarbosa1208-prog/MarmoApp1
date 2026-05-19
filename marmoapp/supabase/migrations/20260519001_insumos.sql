-- Fornecedoras
CREATE TABLE IF NOT EXISTS fornecedoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id uuid NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  contato text,
  telefone text,
  created_at timestamptz DEFAULT now()
);

-- Catálogo de insumos
CREATE TABLE IF NOT EXISTS insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id uuid NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  categoria text,
  estoque_atual numeric(12,2) DEFAULT 0,
  estoque_minimo numeric(12,2) DEFAULT 0,
  preco_unitario numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pedidos de compra para fornecedora
CREATE TABLE IF NOT EXISTS insumo_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id uuid NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  fornecedora_id uuid REFERENCES fornecedoras(id),
  numero_pedido text,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
  data_pedido date DEFAULT CURRENT_DATE,
  data_recebimento date,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS insumo_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES insumo_pedidos(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES insumos(id),
  quantidade numeric(12,2) NOT NULL,
  preco_unitario numeric(12,2),
  created_at timestamptz DEFAULT now()
);

-- Retiradas por funcionário
CREATE TABLE IF NOT EXISTS insumo_retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id uuid NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES insumos(id),
  funcionario_nome text NOT NULL,
  quantidade numeric(12,2) NOT NULL,
  data_retirada date DEFAULT CURRENT_DATE,
  observacao text,
  created_at timestamptz DEFAULT now()
);

-- Triggers updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insumos_updated_at ON insumos;
CREATE TRIGGER insumos_updated_at BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS insumo_pedidos_updated_at ON insumo_pedidos;
CREATE TRIGGER insumo_pedidos_updated_at BEFORE UPDATE ON insumo_pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_insumos_marmoraria ON insumos(marmoraria_id);
CREATE INDEX IF NOT EXISTS idx_insumo_pedidos_marmoraria ON insumo_pedidos(marmoraria_id);
CREATE INDEX IF NOT EXISTS idx_insumo_retiradas_marmoraria ON insumo_retiradas(marmoraria_id);
CREATE INDEX IF NOT EXISTS idx_insumo_retiradas_data ON insumo_retiradas(data_retirada);

-- RLS
ALTER TABLE fornecedoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_retiradas ENABLE ROW LEVEL SECURITY;

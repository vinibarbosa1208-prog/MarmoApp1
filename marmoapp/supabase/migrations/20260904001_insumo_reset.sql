-- Reset de contagem de insumos: permite apagar o historico de retiradas
-- (que ficava desatualizado por falta de registro) e recomecar a contagem
-- do zero a partir de uma recontagem fisica, sem perder o cadastro do
-- insumo nem o estoque_minimo (usado no alerta de estoque baixo).
--
-- Nao mexe em insumo_pedidos / insumo_pedido_itens (historico de compras
-- de fornecedoras fica intacto).

CREATE TABLE IF NOT EXISTS insumo_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marmoraria_id uuid NOT NULL REFERENCES marmorarias(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  lote_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('individual','geral')),
  estoque_anterior numeric(12,2) NOT NULL,
  estoque_novo numeric(12,2) NOT NULL,
  retiradas_removidas integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_reset_log_marmoraria ON insumo_reset_log(marmoraria_id);
CREATE INDEX IF NOT EXISTS idx_insumo_reset_log_insumo ON insumo_reset_log(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_reset_log_lote ON insumo_reset_log(lote_id);

ALTER TABLE insumo_reset_log ENABLE ROW LEVEL SECURITY;

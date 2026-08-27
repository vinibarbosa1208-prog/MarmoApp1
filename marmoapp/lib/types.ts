export type Plan = 'trial' | 'basic' | 'pro' | 'enterprise'

export interface Marmoraria {
  id: string
  nome: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  logo_url?: string | null
  plano: Plan
  trial_expira?: string | null
  ativo: boolean
  owner_id: string
  created_at: string
}

export interface Cliente {
  id: string
  marmoraria_id: string
  nome: string
  tipo: 'pf' | 'pj'
  cpf_cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  origem?: string
  observacoes?: string
  created_at: string
}

export interface OrcamentoItem {
  id?: string
  orcamento_id?: string
  tipo: 'material' | 'servico' | 'frete' | 'outro'
  descricao: string
  quantidade: number
  preco_unitario: number
  total: number
  total_item?: number
  custo_item?: number
  custo_m2?: number
  markup?: number
  largura?: number
  altura?: number
  area?: number
  tipo_peca?: string
  acabamento_esquerda?: string
  acabamento_direita?: string
  acabamento_frente?: string
  acabamento_fundo?: string
  tem_saia?: boolean
  altura_saia?: number
  tem_frontao?: boolean
  altura_frontao?: number
  dados_extras?: Record<string, unknown>
  variante?: string
  nome_variante?: string
  cortado_em?: string | null
  cortado_por?: string | null
  acabado_em?: string | null
  acabado_por?: string | null
}

export type ProducaoStatus =
  | 'comercial'
  | 'aguardando_material'
  | 'em_producao'
  | 'acabamento'
  | 'pronto'
  | 'entregue'

export interface Orcamento {
  id: string
  marmoraria_id: string
  cliente_id?: string
  clienteId?: string
  numero?: number
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expired'
  crm_status?: 'novo' | 'enviado' | 'visualizado' | 'em_negociacao' | 'fechado' | 'perdido'
  producao_status?: ProducaoStatus
  producao_status_atualizado_em?: string
  data_prevista_instalacao?: string
  titulo?: string
  data_validade?: string
  descricao?: string
  mao_obra?: number
  maoObra?: number
  subtotal?: number
  desconto_rs?: number
  desconto?: number
  total?: number
  validade?: string
  observacoes?: string
  itens?: OrcamentoItem[]
  tem_variantes?: boolean
  total_variante_a?: number
  total_variante_b?: number
  total_variante_c?: number
  nome_variante_a?: string
  nome_variante_b?: string
  nome_variante_c?: string
  created_at: string
}

export interface Material {
  id: string
  marmoraria_id: string
  nome: string
  tipo?: string
  unidade: string
  custo_unitario?: number
  preco_venda?: number
  preco_unitario?: number
  preco?: number
  preco_padrao?: number
  estoque_atual?: number
  estoque_minimo?: number
  fornecedor?: string
  created_at: string
}

export interface Servico {
  id: string
  marmoraria_id: string
  nome: string
  descricao?: string
  preco_padrao?: number
  preco?: number
  unidade?: string
  created_at: string
}

export interface OrdemServico {
  id: string
  marmoraria_id: string
  orcamento_id?: string
  cliente_id?: string
  status: 'prod' | 'ready' | 'sched' | 'done'
  descricao?: string
  data_prevista?: string
  created_at: string
}

export interface AppState {
  user: { id: string; email: string } | null
  marmoraria: Marmoraria | null
  clientes: Cliente[]
  orcamentos: Orcamento[]
  os: OrdemServico[]
  materiais: Material[]
  servicos: Servico[]
  editingOrcId: string | null
  orcItems: OrcamentoItem[]
}

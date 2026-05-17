export type ProjectStatus = 'em_andamento' | 'concluido' | 'cancelado'

export interface ProjectCostType {
  id: string
  marmoraria_id: string
  nome: string
  cor: string
  created_at: string
}

export interface ProjectCost {
  id: string
  project_id: string
  tipo_id?: string
  descricao: string
  valor: number
  data: string
  created_at: string
  updated_at: string
  // joined
  tipo?: ProjectCostType
}

export interface Project {
  id: string
  marmoraria_id: string
  orcamento_id?: string
  cliente_id?: string
  nome: string
  descricao?: string
  valor_venda: number
  status: ProjectStatus
  data_inicio?: string
  data_conclusao?: string
  created_at: string
  updated_at: string
  // computed/joined
  custo_total?: number
  margem_valor?: number
  margem_percentual?: number
  cliente_nome?: string
  custos?: ProjectCost[]
}

export interface CreateProjectInput {
  orcamento_id?: string
  cliente_id?: string
  nome: string
  descricao?: string
  valor_venda: number
  status?: ProjectStatus
  data_inicio?: string
  data_conclusao?: string
}

export interface CreateProjectCostInput {
  tipo_id?: string
  descricao: string
  valor: number
  data?: string
}

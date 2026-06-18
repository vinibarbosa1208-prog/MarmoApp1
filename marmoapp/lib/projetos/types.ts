export type ProjectStatus = 'em_andamento' | 'concluido' | 'cancelado'

export interface ProjectCostType {
  id: string
  marmoraria_id: string
  nome: string
  cor: string
  created_at: string
}
export type CustoTipo = 'material' | 'mao_obra' | 'instalacao' | 'operacional' | 'outros'
export type ProjetoEtapa = 'comercial' | 'producao' | 'pronto' | 'agendado' | 'instalacao' | 'concluido'

export interface ProjetoCusto {
  id: string
  projeto_id: string
  marmoraria_id: string
  tipo: CustoTipo
  descricao: string
  valor: number
  data: string
  funcionario_id?: string | null
  created_at: string
}

export interface ProjetoEtapaRecord {
  id: string
  projeto_id: string
  etapa: ProjetoEtapa
  entrada_em: string
  saida_em?: string | null
  dias_na_etapa?: number | null
}

export interface Projeto {
  id: string
  marmoraria_id: string
  orcamento_id?: string | null
  cliente_id?: string | null
  titulo: string
  descricao?: string | null
  valor_venda: number
  status: ProjectStatus
  data_inicio?: string | null
  data_conclusao?: string | null
  custo_material: number
  custo_mao_obra: number
  custo_instalacao: number
  custo_operacional: number
  custo_total: number
  margem_lucro: number
  created_at: string
  updated_at: string
  // computed/joined
  cliente_nome?: string | null
  margem_percentual?: number
  custos?: ProjetoCusto[]
  etapas?: ProjetoEtapaRecord[]
  orcamento_itens?: Array<{ tipo: string; custo_item: number | null; total_item: number | null }>
}

export interface CreateProjetoInput {
  orcamento_id?: string
  cliente_id?: string
  titulo: string
  descricao?: string
  valor_venda: number
  status?: ProjectStatus
  data_inicio?: string
  data_conclusao?: string
}

export interface CreateProjetoCustoInput {
  tipo: CustoTipo
  descricao: string
  valor: number
  data?: string
  funcionario_id?: string
}

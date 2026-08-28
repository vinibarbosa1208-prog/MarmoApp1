export type EventStatus = 'agendado' | 'concluido' | 'cancelado'

export interface AgendaEventType {
  id: string
  marmoraria_id: string
  nome: string
  cor: string
  icone?: string
  created_at: string
}

export interface AgendaEvent {
  id: string
  marmoraria_id: string
  tipo_id?: string
  titulo: string
  descricao?: string
  data_inicio: string
  data_fim?: string
  dia_inteiro: boolean
  cliente_id?: string
  orcamento_id?: string
  responsavel_id?: string
  funcionario_id?: string
  status: EventStatus
  created_at: string
  updated_at: string
  // joined fields
  tipo?: AgendaEventType
  cliente_nome?: string
  responsavel_nome?: string
  funcionario?: { id: string; nome: string; cargo: string }
}

export interface CreateAgendaEventInput {
  tipo_id?: string
  titulo: string
  descricao?: string
  data_inicio: string
  data_fim?: string
  dia_inteiro?: boolean
  cliente_id?: string
  orcamento_id?: string
  responsavel_id?: string
  funcionario_id?: string
}

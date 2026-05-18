export type FieldType = 'texto' | 'numero' | 'data' | 'booleano'

export interface ProjectCustomStatus {
  id: string
  marmoraria_id: string
  nome: string
  cor: string
  ordem: number
  created_at: string
}

export interface ClientCustomField {
  id: string
  marmoraria_id: string
  nome: string
  tipo: FieldType
  obrigatorio: boolean
  ordem: number
  created_at: string
}

export interface ClientCustomFieldValue {
  id: string
  field_id: string
  cliente_id: string
  valor: string | null
  created_at: string
}

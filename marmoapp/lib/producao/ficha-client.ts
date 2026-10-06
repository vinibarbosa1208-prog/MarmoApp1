// Tipos e fetch helper compartilhados pelos componentes client da tela da
// ficha semanal (app/(app)/producao/ficha). Mesmo padrão de apiFetch já
// usado em app/(app)/funcionarios/page.tsx — cookies de sessão, sem header
// de auth manual.

export function apiFetch(url: string, init?: RequestInit) {
  return fetch(url, { credentials: 'include', ...init })
}

export async function extractError(res: Response, fallback = 'Erro ao salvar'): Promise<string> {
  try {
    const data = await res.json()
    return data?.error || fallback
  } catch {
    return fallback
  }
}

export type EtapaFicha = 'corte' | 'acabamento' | 'instalacao'

export interface LinhaFicha {
  id: string
  etapa: EtapaFicha
  data: string
  quantidade: number
  quantidade_sistema: number | null
  unidade: 'm2' | 'ml'
  tipo_acabamento: 'reto' | 'meia_esquadria' | null
  peca_descricao: string | null
  medida_comprimento: number | null
  medida_largura: number | null
  status: 'pendente' | 'aprovado' | 'rejeitado'
  origem: string
  funcionario_id: string | null
  orcamento_id: string | null
  orcamento_item_id: string | null
  obra_nome_avulso: string | null
  valor_calculado: number | null
  valor_metro_linear_aplicado: number | null
  is_retroativo: boolean
  cliente_nome: string | null
  pedido_label: string | null
  pedido_numero: number | null
  editavel: boolean
}

export interface FichaGetResponse {
  ficha: {
    id: string
    pessoa_id: string
    semana_inicio: string
    status: 'aberta' | 'fechada'
    fechada_em: string | null
    fechada_por: string | null
    arquivo_url: string | null
  }
  fator_meia_esquadria: number
  pessoa: { pessoaId: string; nome: string; modelo: 'corte' | 'acabamento'; etapas: EtapaFicha[] }
  linhas: LinhaFicha[]
}

export interface PedidoBusca {
  id: string
  numero: number | null
  titulo: string | null
  producao_status: string | null
  cliente_nome: string | null
}

export interface PecaDisponivel {
  id: string
  descricao: string
  ambiente: string | null
  tipo_peca: string | null
  quantidade_sistema: number
  unidade: 'm2' | 'ml'
  registrada: { data: string; quantidade: number | null; funcionario_nome: string | null } | null
}

export interface SemanaResumo {
  semana_inicio: string
  status: 'aberta' | 'fechada'
  fichas: number
}

export const LABEL_ETAPA: Record<EtapaFicha, string> = {
  corte: 'Corte',
  acabamento: 'Acabamento',
  instalacao: 'Instalação',
}

export const UNIDADE_LABEL: Record<'m2' | 'ml', string> = { m2: 'm²', ml: 'ml' }

export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export interface Marmoraria {
  id: string
  nome: string
  plano: string | null
  trial_expira: string | null
  setup_concluido: boolean | null
  created_at: string
}

export interface Usuario {
  id: string
  marmoraria_id: string
  nome: string | null
  email: string | null
  perfil: string | null
}

export interface Orcamento {
  id: string
  marmoraria_id: string
  cliente_nome: string | null
  status: string | null
  valor_total: number | null
  created_at: string
}

export interface Assinatura {
  id: string
  marmoraria_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  status: string | null
}

export interface ErrorLog {
  id: string
  route: string | null
  error_message: string | null
  error_stack: string | null
  user_id: string | null
  marmoraria_id: string | null
  created_at: string
  marmorarias?: { nome: string } | null
}

export interface MetricasKPI {
  mrr: number
  arr: number
  clientesPagantes: number
  trialsAtivos: number
  totalCadastros: number
  taxaActivation: number
  orcamentosHoje: number
  orcamentosSemana: number
}

export interface ChurnRisk {
  id: string
  nome: string
  plano: string | null
  ultimo_orcamento: string | null
  dias_sem_uso: number | null
}

export interface OrcamentosPorDia {
  data: string
  total: number
}

export const PLANO_PRECOS: Record<string, number> = {
  basic: 147,
  pro: 297,
  enterprise: 497,
}

export const ALLOWED_ADMIN_EMAILS = ['contato@vinicius.dev']
export const ALLOWED_ADMIN_DOMAINS = ['@marmoapp.com']

export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return (
    ALLOWED_ADMIN_EMAILS.includes(lower) ||
    ALLOWED_ADMIN_DOMAINS.some((d) => lower.endsWith(d))
  )
}

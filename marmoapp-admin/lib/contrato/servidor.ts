import {
  calcularValores,
  documentoValido,
  cpfValido,
  soDigitos,
  PLANOS,
  type Condicao,
  type DadosContrato,
  type Parte,
  type PlanoKey,
} from './modelo'

// Dados da MarmorarIA (CONTRATADA), configurados nas variáveis de ambiente do painel.
export function contratadaPadrao(): Parte {
  return {
    razao_social: process.env.CONTRATADA_RAZAO_SOCIAL ?? '',
    documento: soDigitos(process.env.CONTRATADA_CNPJ),
    endereco: process.env.CONTRATADA_ENDERECO ?? '',
    representante: process.env.CONTRATADA_REPRESENTANTE ?? 'Vinicius Barbosa',
  }
}

export function contratadaPronta(c: Parte): string | null {
  if (!c.razao_social || !c.endereco) return 'Configure CONTRATADA_RAZAO_SOCIAL e CONTRATADA_ENDERECO no painel da Vercel.'
  if (!documentoValido(c.documento)) return 'Configure CONTRATADA_CNPJ (CNPJ válido) no painel da Vercel.'
  return null
}

function texto(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function lerContratante(v: unknown): Parte {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    razao_social: texto(o.razao_social, 160),
    documento: soDigitos(texto(o.documento, 30)),
    endereco: texto(o.endereco, 300),
    representante: texto(o.representante, 120),
    cpf_representante: soDigitos(texto(o.cpf_representante, 20)),
    email: texto(o.email, 160).toLowerCase(),
    whatsapp: texto(o.whatsapp, 30),
    cidade: texto(o.cidade, 80),
  }
}

/** Problemas que impedem enviar o contrato para assinatura (vazio = pode enviar). */
export function pendenciasContratante(p: Parte): string[] {
  const erros: string[] = []
  if (!p.razao_social) erros.push('Razão social da marmoraria')
  if (!documentoValido(p.documento)) erros.push('CNPJ ou CPF válido da marmoraria')
  if (!p.endereco) erros.push('Endereço da marmoraria')
  if (!p.representante) erros.push('Nome de quem assina')
  if (!p.cpf_representante || !cpfValido(p.cpf_representante)) erros.push('CPF válido de quem assina')
  if (!p.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) erros.push('E-mail de quem assina (recebe o código)')
  return erros
}

export interface EntradaContrato {
  plano: PlanoKey
  condicao: Condicao
  dia_vencimento: number
  data_ativacao_antonio: string | null
  antonio_ativo: boolean
}

export function lerEntrada(b: Record<string, unknown>): EntradaContrato | string {
  const plano = String(b.plano) as PlanoKey
  if (!PLANOS[plano]) return 'Escolha o plano.'
  const condicao = b.condicao === 'tabela' ? 'tabela' : 'fundador'
  const dia = parseInt(String(b.dia_vencimento), 10)
  if (!(dia >= 1 && dia <= 28)) return 'O dia de vencimento vai de 1 a 28.'
  const data = typeof b.data_ativacao_antonio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.data_ativacao_antonio)
    ? b.data_ativacao_antonio
    : null
  if (PLANOS[plano].temAntonioWhatsapp && !b.antonio_ativo && !data) return 'Informe a data de ativação do Antônio no WhatsApp.'
  return { plano, condicao, dia_vencimento: dia, data_ativacao_antonio: data, antonio_ativo: b.antonio_ativo === true }
}

/** Colunas do contrato calculadas a partir da entrada (valores sempre no servidor). */
export function colunasDoContrato(e: EntradaContrato, contratante: Parte) {
  const v = calcularValores(e.plano, e.condicao, e.antonio_ativo)
  const P = PLANOS[e.plano]
  return {
    plano: e.plano,
    condicao: e.condicao,
    mensalidade: v.mensalidade,
    implantacao: v.implantacao,
    valor_por_medicao: v.valor_por_medicao,
    fidelidade_meses: v.fidelidade_meses,
    dia_vencimento: e.dia_vencimento,
    data_ativacao_antonio: P.temAntonioWhatsapp && !e.antonio_ativo ? e.data_ativacao_antonio : null,
    mensalidade_ate_ativacao: v.mensalidade_ate_ativacao,
    primeira_cobranca: v.primeira_cobranca,
    contratante,
  }
}

export interface LinhaContrato {
  id: string
  numero: string
  plano: PlanoKey
  condicao: Condicao
  mensalidade: number | string
  implantacao: number | string
  valor_por_medicao: number | string | null
  fidelidade_meses: number
  dia_vencimento: number
  data_ativacao_antonio: string | null
  mensalidade_ate_ativacao: number | string | null
  primeira_cobranca: number | string
  contratante: Parte
  contratada: Parte
}

const num = (v: number | string | null) => (v === null ? null : Number(v))

export function dadosDaLinha(r: LinhaContrato): DadosContrato {
  return {
    numero: r.numero,
    plano: r.plano,
    condicao: r.condicao,
    mensalidade: Number(r.mensalidade),
    implantacao: Number(r.implantacao),
    valor_por_medicao: num(r.valor_por_medicao),
    fidelidade_meses: r.fidelidade_meses,
    dia_vencimento: r.dia_vencimento,
    data_ativacao_antonio: r.data_ativacao_antonio,
    mensalidade_ate_ativacao: num(r.mensalidade_ate_ativacao),
    primeira_cobranca: Number(r.primeira_cobranca),
    contratante: r.contratante,
    contratada: r.contratada,
  }
}

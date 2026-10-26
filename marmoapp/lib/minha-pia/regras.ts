// Pia Programada — regras puras (sem acesso a banco), usadas no servidor
// e nas telas. Nada aqui pode importar módulos de Node.

export type StatusAdesao =
  | 'aguardando_pagamento' | 'ativa' | 'pausada' | 'quitada' | 'medicao_agendada'
  | 'em_producao' | 'instalacao_agendada' | 'instalada' | 'cancelada'

export const STATUS_LABEL: Record<StatusAdesao, string> = {
  aguardando_pagamento: 'Aguardando 1º pagamento',
  ativa: 'Pagando',
  pausada: 'Pausada',
  quitada: 'Quitada — na fila',
  medicao_agendada: 'Medição agendada',
  em_producao: 'Em produção',
  instalacao_agendada: 'Instalação agendada',
  instalada: 'Instalada',
  cancelada: 'Cancelada',
}

// Status em que o cliente ainda está pagando (pode gerar cobrança).
export const STATUS_PAGANDO: StatusAdesao[] = ['aguardando_pagamento', 'ativa', 'pausada']
// Status depois da quitação, em ordem — vira a linha do tempo da obra.
export const ETAPAS_OBRA: { status: StatusAdesao; titulo: string; texto: string }[] = [
  { status: 'quitada', titulo: 'Pia quitada', texto: 'Seu pedido entrou na fila de produção.' },
  { status: 'medicao_agendada', titulo: 'Medição', texto: 'Vamos até sua casa conferir as medidas.' },
  { status: 'em_producao', titulo: 'Produção', texto: 'Corte e acabamento da sua pedra.' },
  { status: 'instalacao_agendada', titulo: 'Instalação agendada', texto: 'Data marcada para instalar.' },
  { status: 'instalada', titulo: 'Pia instalada', texto: 'Pronto! Aproveite sua cozinha nova.' },
]
export const STATUS_NA_FILA: StatusAdesao[] = ['quitada', 'medicao_agendada', 'em_producao', 'instalacao_agendada']

export const ANTECIPACAO_MINIMA = 50
export const LIMITE_MESES = 18

export function soDigitos(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '')
}

export function cpfValido(cpfRaw: string): boolean {
  const cpf = soDigitos(cpfRaw)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (base: string, pesoIni: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoIni - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10])
}

export function whatsappValido(v: string): boolean {
  const d = soDigitos(v)
  return d.length === 11 && d[2] === '9'
}

export function fmtCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function fmtFone(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function fmtReais(v: number, centavos = false): string {
  return 'R$ ' + v.toLocaleString('pt-BR', {
    minimumFractionDigits: centavos ? 2 : 0,
    maximumFractionDigits: centavos ? 2 : 0,
  })
}

export function mesesParaQuitar(total: number, parcela: number): number {
  return Math.ceil(total / parcela)
}

// Opções de parcela que fazem sentido para um kit (no máx. LIMITE_MESES).
export function opcoesParcela(total: number, opcoes: number[]): number[] {
  return opcoes.filter(p => p > 0 && mesesParaQuitar(total, p) <= LIMITE_MESES).sort((a, b) => a - b)
}

// ── Datas (sempre em horário de São Paulo, como string YYYY-MM-DD) ──
export function hojeSP(): string {
  return dataSP(new Date().toISOString())
}

export function dataSP(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(isoTimestamp))
}

function ymd(ano: number, mes0: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes0, 1))
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(data + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Parcela 0 = entrada, paga no dia da adesão. As seguintes vencem no
// dia escolhido, a partir do mês seguinte.
export function vencimentoParcela(dataAdesao: string, diaVenc: number, indice: number): string {
  if (indice <= 0) return dataAdesao
  const [a, m] = dataAdesao.split('-').map(Number)
  return ymd(a, m - 1 + indice, diaVenc)
}

export function fmtData(iso: string | null | undefined, comAno = true): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', ...(comAno ? { year: 'numeric' } : {}), timeZone: 'America/Sao_Paulo' })
}

export function fmtMesAno(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Resumo financeiro de uma adesão ──
export interface AdesaoParaResumo {
  valor_total: number
  valor_parcela: number
  dia_vencimento: number
  total_pago: number
  desconto: number
  status: StatusAdesao
  created_at: string
  oferta_quitacao_valor: number | null
  oferta_validade: string | null
}

export interface ResumoAdesao {
  pago: number
  saldo: number
  progresso: number            // 0–100
  parcelasTotal: number
  parcelasPagas: number
  proximaParcelaValor: number
  proximaParcelaVencimento: string | null
  atrasada: boolean
  valorQuitarHoje: number      // saldo, ou oferta se estiver valendo
  ofertaAtiva: boolean
  previsaoQuitacao: string | null
  previsaoInstalacao: string | null
}

export function resumoAdesao(a: AdesaoParaResumo, prazoEntregaDias: number, hoje = hojeSP()): ResumoAdesao {
  const total = Number(a.valor_total)
  const parcela = Number(a.valor_parcela)
  const coberto = Number(a.total_pago) + Number(a.desconto)
  const saldo = Math.max(0, Math.round((total - coberto) * 100) / 100)
  const parcelasTotal = mesesParaQuitar(total, parcela)
  const parcelasPagas = Math.min(parcelasTotal, Math.floor((coberto + 0.001) / parcela))
  const resto = Math.round((coberto - parcelasPagas * parcela) * 100) / 100
  const dataAdesao = dataSP(a.created_at)
  const pagando = STATUS_PAGANDO.includes(a.status)

  const proximaParcelaValor = saldo > 0 ? Math.min(saldo, Math.round((parcela - resto) * 100) / 100) : 0
  const proximaParcelaVencimento = saldo > 0 && pagando ? vencimentoParcela(dataAdesao, a.dia_vencimento, parcelasPagas) : null
  const atrasada = !!proximaParcelaVencimento && proximaParcelaVencimento < hoje && a.status !== 'pausada'

  const ofertaAtiva = pagando && a.oferta_quitacao_valor != null && Number(a.oferta_quitacao_valor) > 0
    && Number(a.oferta_quitacao_valor) < saldo && (!a.oferta_validade || a.oferta_validade >= hoje)
  const valorQuitarHoje = ofertaAtiva ? Number(a.oferta_quitacao_valor) : saldo

  let previsaoQuitacao: string | null = null
  if (pagando && saldo > 0) {
    const faltam = Math.ceil(saldo / parcela)
    const base = proximaParcelaVencimento && proximaParcelaVencimento > hoje ? proximaParcelaVencimento : hoje
    const [ano, mes, dia] = base.split('-').map(Number)
    previsaoQuitacao = faltam <= 1 ? base : ymd(ano, mes - 1 + faltam - 1, a.dia_vencimento || dia)
  }
  const previsaoInstalacao = previsaoQuitacao ? somarDias(previsaoQuitacao, prazoEntregaDias) : null

  return {
    pago: Number(a.total_pago),
    saldo,
    progresso: Math.min(100, Math.round((coberto / total) * 100)),
    parcelasTotal,
    parcelasPagas,
    proximaParcelaValor,
    proximaParcelaVencimento,
    atrasada,
    valorQuitarHoje,
    ofertaAtiva,
    previsaoQuitacao,
    previsaoInstalacao,
  }
}

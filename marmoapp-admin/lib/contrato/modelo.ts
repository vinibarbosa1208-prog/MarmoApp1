// Modelo do contrato da MarmorarIA. Mudou o texto? Suba a VERSAO_MODELO: contratos já
// enviados guardam o próprio texto congelado e não mudam.
export const VERSAO_MODELO = 'MIA-2026-11-v1'

// Último dia da condição de fundador (Black Friday 2026), no horário de Brasília.
export const FIM_CONDICAO_FUNDADOR = '2026-11-30'

// Frase que quem assina marca na página (fica gravada no registro da assinatura).
export const TEXTO_ACEITE =
  'Li o contrato completo, concordo com todas as cláusulas e assino eletronicamente em nome da CONTRATANTE, nos termos do art. 10, § 2º, da MP 2.200-2/2001.'

export type PlanoKey = 'gestao' | 'operacao' | 'crescimento'
export type Condicao = 'fundador' | 'tabela'

export const PLANOS: Record<
  PlanoKey,
  {
    nome: string
    tabela: { mensalidade: number; implantacao: number }
    fundador: { mensalidade: number; implantacao: number }
    fidelidade: number
    temAntonioWhatsapp: boolean
    porMedicao: number | null
  }
> = {
  gestao: {
    nome: 'Gestão com IA',
    tabela: { mensalidade: 297, implantacao: 1200 },
    fundador: { mensalidade: 297, implantacao: 0 },
    fidelidade: 0,
    temAntonioWhatsapp: false,
    porMedicao: null,
  },
  operacao: {
    nome: 'Operação com IA',
    tabela: { mensalidade: 950, implantacao: 2400 },
    fundador: { mensalidade: 790, implantacao: 0 },
    fidelidade: 3,
    temAntonioWhatsapp: true,
    porMedicao: null,
  },
  crescimento: {
    nome: 'Operação + Crescimento',
    tabela: { mensalidade: 1850, implantacao: 3300 },
    fundador: { mensalidade: 1490, implantacao: 0 },
    fidelidade: 3,
    temAntonioWhatsapp: true,
    porMedicao: 60,
  },
}

// Enquanto o Antônio não está no WhatsApp, os planos Operação têm a mensalidade reduzida
// no valor que ele representa no Operação com IA (R$ 790 − R$ 297 = R$ 493).
export const DESCONTO_ATE_ATIVACAO = 493

export interface Parte {
  razao_social: string
  documento: string // CNPJ ou CPF, só números
  endereco: string
  representante: string
  cpf_representante?: string
  email?: string
  whatsapp?: string
  cidade?: string
}

export interface DadosContrato {
  numero: string
  plano: PlanoKey
  condicao: Condicao
  mensalidade: number
  implantacao: number
  valor_por_medicao: number | null
  fidelidade_meses: number
  dia_vencimento: number
  data_ativacao_antonio: string | null // YYYY-MM-DD
  mensalidade_ate_ativacao: number | null
  primeira_cobranca: number
  contratante: Parte
  contratada: Parte
}

export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function condicaoPadrao(): Condicao {
  return hojeSaoPaulo() <= FIM_CONDICAO_FUNDADOR ? 'fundador' : 'tabela'
}

/** Valores do plano, com a regra do Antônio e a primeira cobrança. */
export function calcularValores(plano: PlanoKey, condicao: Condicao, antonioAtivo: boolean) {
  const P = PLANOS[plano]
  const base = condicao === 'fundador' ? P.fundador : P.tabela
  const mensalidadeAteAtivacao =
    P.temAntonioWhatsapp && !antonioAtivo ? Math.max(base.mensalidade - DESCONTO_ATE_ATIVACAO, 0) : null
  // Fundador: 1ª mensalidade na assinatura. Tabela: implantação na assinatura e mensalidade a partir do 30º dia.
  const primeira =
    condicao === 'fundador' ? mensalidadeAteAtivacao ?? base.mensalidade : base.implantacao
  return {
    mensalidade: base.mensalidade,
    implantacao: base.implantacao,
    implantacao_tabela: P.tabela.implantacao,
    mensalidade_tabela: P.tabela.mensalidade,
    fidelidade_meses: P.fidelidade,
    valor_por_medicao: P.porMedicao,
    mensalidade_ate_ativacao: mensalidadeAteAtivacao,
    primeira_cobranca: primeira,
  }
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

export function documentoValido(doc: string): boolean {
  const d = soDigitos(doc)
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

export function cpfValido(v: string): boolean {
  const d = soDigitos(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += parseInt(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10])
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + parseInt(d[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13])
}

export function formatarDocumento(v: string): string {
  const d = soDigitos(v)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

function dataBR(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const PREFIXO_DOC = (doc: string) => (soDigitos(doc).length === 14 ? 'CNPJ' : 'CPF')

/**
 * Texto completo do contrato. Formato simples, uma linha por bloco:
 * "# " título, "## " seção, "N. " cláusula numerada, demais linhas são parágrafos.
 */
export function gerarTexto(c: DadosContrato): string {
  const P = PLANOS[c.plano]
  const op = P.temAntonioWhatsapp
  const cresc = c.plano === 'crescimento'
  const ct = c.contratante
  const cd = c.contratada
  const L: string[] = []

  L.push('# Contrato de prestação de serviços e licença de uso — MarmorarIA')
  L.push(`Contrato nº ${c.numero} · modelo ${VERSAO_MODELO}`)

  L.push('## Partes')
  L.push(
    `CONTRATADA: ${cd.razao_social}, inscrita no ${PREFIXO_DOC(cd.documento)} sob o nº ${formatarDocumento(cd.documento)}, com sede em ${cd.endereco}, titular da marca MarmorarIA, representada por ${cd.representante}.`
  )
  L.push(
    `CONTRATANTE: ${ct.razao_social}, inscrita no ${PREFIXO_DOC(ct.documento)} sob o nº ${formatarDocumento(ct.documento)}, com sede em ${ct.endereco}, representada por ${ct.representante}` +
      (ct.cpf_representante ? `, CPF ${formatarDocumento(ct.cpf_representante)}` : '') +
      (ct.email ? `, e-mail ${ct.email}` : '') +
      (ct.whatsapp ? `, WhatsApp ${ct.whatsapp}` : '') +
      '.'
  )

  L.push('## Plano contratado')
  L.push(
    `Plano: ${P.nome}, na ${c.condicao === 'fundador' ? `condição de fundador (contratos assinados até ${dataBR(FIM_CONDICAO_FUNDADOR)})` : 'tabela vigente'}.`
  )
  L.push(
    `Mensalidade: ${brl(c.mensalidade)}` +
      (c.condicao === 'fundador' ? ', fixa por 12 meses a partir da assinatura' : '') +
      (c.valor_por_medicao ? `, mais ${brl(c.valor_por_medicao)} por medição agendada pela IA` : '') +
      '.'
  )
  L.push(
    `Implantação: ${brl(c.implantacao)}` +
      (c.implantacao === 0 ? ` (sem custo na condição de fundador; valor de tabela ${brl(PLANOS[c.plano].tabela.implantacao)})` : '') +
      '.'
  )
  if (op && c.data_ativacao_antonio) {
    L.push(
      `Ativação do Antônio no WhatsApp da CONTRATANTE: até ${dataBR(c.data_ativacao_antonio)}.` +
        (c.mensalidade_ate_ativacao != null ? ` Até a ativação, a mensalidade cobrada é de ${brl(c.mensalidade_ate_ativacao)}.` : '')
    )
  }
  L.push(
    `Fidelidade: ${c.fidelidade_meses > 0 ? `${c.fidelidade_meses} meses` : 'sem fidelidade'}. Vencimento: todo dia ${c.dia_vencimento}. Primeira cobrança: ${brl(c.primeira_cobranca)}, com vencimento em até 3 dias após a assinatura.`
  )

  L.push('## Cláusulas')
  let n = 0
  const cl = (t: string) => L.push(`${++n}. ${t}`)

  cl(
    `Objeto. A CONTRATADA implanta e mantém o sistema MarmoApp na operação da CONTRATANTE (orçamento, produção, estoque e financeiro), com o Antônio para orçar por texto e áudio` +
      (op ? ', o desenho das rotinas da marmoraria, o Antônio no WhatsApp da CONTRATANTE e a reunião mensal de indicadores' : '') +
      (cresc ? `, além dos anúncios na região de ${ct.cidade || '[cidade]'} e do agendamento de medições pela IA` : '') +
      '. A licença de uso do sistema vale enquanto o contrato estiver ativo.'
  )
  cl(
    'Implantação. Começa com a reunião de início, marcada em até 7 dias após o pagamento da primeira cobrança, e leva cerca de 3 semanas. Inclui o cadastro de pedras, serviços e preços, o lançamento no sistema dos orçamentos e obras em aberto informados pela CONTRATANTE e o treino da equipe. A CONTRATANTE indica uma pessoa de contato e fornece as informações pedidas.'
  )
  if (op) {
    cl(
      `Antônio no WhatsApp. O assistente será ativado no WhatsApp da CONTRATANTE até ${c.data_ativacao_antonio ? dataBR(c.data_ativacao_antonio) : '[data]'}. Até a ativação, a mensalidade cobrada é a indicada em "Plano contratado"; o valor integral passa a valer no mês seguinte à ativação. Se a data não for cumprida, a CONTRATANTE pode cancelar sem multa. O Antônio sempre se apresenta como assistente virtual, informa preços apenas em faixa e passa a conversa para a CONTRATANTE em negociação ou reclamação.`
    )
  }
  cl(
    op
      ? `Vigência e fidelidade. O contrato vale por prazo indeterminado, com fidelidade de ${c.fidelidade_meses} meses a partir da assinatura. Depois dela, qualquer parte pode cancelar com aviso de 30 dias.`
      : 'Vigência. O contrato vale por prazo indeterminado e pode ser cancelado por qualquer parte, a qualquer momento, com aviso de 30 dias.'
  )
  cl(
    'Garantia de 30 dias. Nos primeiros 30 dias após a assinatura, a CONTRATANTE pode cancelar sem multa, pagando apenas as cobranças já vencidas.'
  )
  if (op) {
    cl(
      'Saída antecipada. Fora da garantia, o cancelamento pela CONTRATANTE dentro da fidelidade gera multa igual às mensalidades que faltam para completar a fidelidade.'
    )
  }
  cl(
    `Pagamento. As cobranças são emitidas pela plataforma Asaas, por PIX, boleto ou cartão, com vencimento todo dia ${c.dia_vencimento}. Atraso superior a 15 dias permite à CONTRATADA suspender o acesso ao sistema até a regularização, sem prejuízo da cobrança. ` +
      (c.condicao === 'fundador'
        ? 'A mensalidade fica fixa por 12 meses; depois, é reajustada uma vez por ano pela variação do IPCA.'
        : 'A mensalidade é reajustada uma vez por ano pela variação do IPCA.')
  )
  if (cresc) {
    cl(
      `Anúncios e exclusividade. A verba de mídia é paga pela CONTRATANTE diretamente ao Meta ou ao Google e não está incluída na mensalidade. Cada medição agendada pela IA e confirmada pela CONTRATANTE custa ${brl(c.valor_por_medicao ?? 60)}, cobrada no mês seguinte. Enquanto o contrato estiver ativo, a CONTRATADA não atende outra marmoraria em ${ct.cidade || '[cidade]'} com este plano.`
    )
  }
  cl(
    'Dados. Os dados cadastrados no sistema pertencem à CONTRATANTE e podem ser exportados a qualquer momento. A CONTRATADA trata esses dados apenas para prestar o serviço, conforme a Lei 13.709/2018 (LGPD), e não os compartilha com terceiros, salvo os fornecedores necessários à operação (hospedagem, mensagens e pagamentos). Números da operação da CONTRATANTE só aparecem em material de divulgação com autorização por escrito.'
  )
  cl(
    'Responsabilidade. A CONTRATADA entrega o sistema, a implantação e o acompanhamento contratados. Os resultados de vendas, produção e caixa dependem também da operação da CONTRATANTE e não são garantidos.'
  )
  cl(
    'Assinatura eletrônica. As partes admitem como válida a assinatura eletrônica deste contrato, nos termos do art. 10, § 2º, da Medida Provisória 2.200-2/2001, feita na plataforma MarmoApp com confirmação de código enviado ao e-mail do representante da CONTRATANTE. Ficam registrados nome, CPF, e-mail, data, hora, endereço IP, navegador e o código de integridade (hash SHA-256) deste texto. Esses dados são usados apenas para comprovar a assinatura (LGPD, art. 7º, V).'
  )
  cl('Foro. As partes elegem o foro da comarca de Arujá-SP para resolver questões deste contrato.')

  return L.join('\n')
}

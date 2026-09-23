import type { Orcamento, OrcamentoItem } from './types'

// Campos de medida/preço do orçamento aceitam vírgula OU ponto como
// separador decimal (input type="text" + inputMode="decimal", não
// type="number" — o número nativo do navegador rejeita vírgula conforme o
// idioma do sistema e o campo simplesmente não preenche).
export function parseNumBR(str: string | number | null | undefined): number {
  if (str === null || str === undefined) return 0
  if (typeof str === 'number') return isNaN(str) ? 0 : str
  const n = parseFloat(str.replace(',', '.').trim())
  return isNaN(n) ? 0 : n
}

export function parseIntBR(str: string | number | null | undefined): number {
  if (str === null || str === undefined) return 0
  if (typeof str === 'number') return isNaN(str) ? 0 : Math.round(str)
  const n = parseInt(str.replace(',', '.').trim(), 10)
  return isNaN(n) ? 0 : n
}

// Wrapper seguro para operações Supabase: timeout de 12s + garante setLoading(false) via finally
type SbResult = { data: any; error: any }
export async function sbSave(
  operation: PromiseLike<SbResult>,
  timeoutMs = 12000
): Promise<SbResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.')),
      timeoutMs
    )
  )
  return Promise.race([operation as Promise<SbResult>, timeout])
}

// Erros de RLS/JWT expirado (ex: sessão caiu durante a edição) chegam como
// 401/403 ou código do Postgrest — a mensagem crua confunde o usuário, então
// trocamos por uma orientação clara pra recarregar e renovar a sessão.
export function authErrorMessage(err: any, fallback = 'Erro ao salvar. Tente novamente.'): string {
  const isAuthError =
    err?.code === 'PGRST301' ||
    err?.code === '42501' ||
    err?.status === 401 ||
    /jwt|token/i.test(err?.message || '')
  return isAuthError
    ? 'Sua sessão expirou. Recarregue a página e faça login novamente.'
    : (err?.message || err?.details || fallback)
}

export function fmt(v: number | string | undefined | null): string {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function orcTotal(o: Orcamento): number {
  const itens = o.itens || []
  const sub = itens.reduce((s, i) => s + (parseFloat(String(i.total ?? i.total_item ?? 0)) || 0), 0)
  return sub + (parseFloat(String(o.maoObra ?? o.mao_obra ?? 0)) || 0)
       - (parseFloat(String(o.desconto ?? o.desconto_rs ?? 0)) || 0)
}

export function formatPhone(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3')
  else v = v.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3')
  return v
}

export function formatCEP(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{5})(\d)/, '$1-$2')
  return v
}

export function formatCNPJ(value: string): string {
  let v = value.replace(/\D/g, '').slice(0, 14)
  v = v.replace(/(\d{2})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1/$2')
  v = v.replace(/(\d{4})(\d)/, '$1-$2')
  return v
}

export async function fetchCEP(cep: string): Promise<{ logradouro?: string; localidade?: string; uf?: string } | null> {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    const d = await r.json()
    if (d.erro) return null
    return d
  } catch {
    return null
  }
}

export const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  recusado: 'Recusado', expired: 'Expirado',
  novo: 'Novo', visualizado: 'Visualizado',
  em_negociacao: 'Em Negociação', fechado: 'Fechado', perdido: 'Perdido',
}

export const PRODUCAO_LABELS: Record<string, string> = {
  comercial: 'Comercial', aguardando_material: 'Aguardando Material',
  em_producao: 'Em Produção', acabamento: 'Acabamento',
  pronto: 'Pronto', entregue: 'Entregue',
}

export const PLANOS = {
  basic:      { nome: 'Plano Basic',      preco: 'R$ 147/mês', price_id: 'price_1TRoPv1opvb2dbnSbv8JBAV0' },
  pro:        { nome: 'Plano Pro',        preco: 'R$ 297/mês', price_id: 'price_1TRoSs1opvb2dbnS8g0agPvL' },
  enterprise: { nome: 'Plano Enterprise', preco: 'R$ 497/mês', price_id: 'price_1TRoTB1opvb2dbnS57zLUfQT' },
}

// === PCP (Controle de Produção) ===
// Mede automaticamente, a partir dos próprios itens já lançados no orçamento,
// quanto foi processado quando um pedido sai de uma etapa. Usa a mesma
// convenção de dimensões do restante do app: frente/fundo = largura,
// esquerda/direita = altura.

// m² de pedra cortada — soma da área de cada item (já calculada na criação do orçamento)
export function areaCortadaItens(itens: Pick<OrcamentoItem, 'area' | 'quantidade'>[]): number {
  return itens.reduce((s, i) => s + ((i.area || 0) * (i.quantidade || 1)), 0)
}

type ItemAcabamentoLinear = Pick<OrcamentoItem,
  'tipo_peca' | 'dados_extras' | 'largura' | 'altura' | 'quantidade' |
  'acabamento_esquerda' | 'acabamento_direita' | 'acabamento_frente' | 'acabamento_fundo'
>

// metros lineares de acabamento de UM item — soma o comprimento de cada
// lateral que tem algum tipo de acabamento marcado (reto/boleado/meia
// esquadria/frontão; saia conta pois força acabamento meia_esquadria na
// lateral). Os comprimentos de cada lateral seguem a mesma lógica usada em
// calcArea (novo/editar orçamento), lendo de dados_extras para os desenhos
// cuja dimensão não fica salva em largura/altura.
function mlAcabamentoItem(item: ItemAcabamentoLinear): number {
  const ex = (item.dados_extras || {}) as Record<string, unknown>
  let dimMap: Record<string, number> = {}
  let acabs: Record<string, string> = {}

  switch (item.tipo_peca) {
    case 'bancada_simples': {
      const l = item.largura || 0
      const a = item.altura || 0
      dimMap = { frente: l, fundo: l, esquerda: a, direita: a }
      acabs = {
        frente: item.acabamento_frente || '', fundo: item.acabamento_fundo || '',
        esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '',
      }
      break
    }
    case 'lavatorio_simples': {
      const comprimento = (ex.comprimento as number) || 0
      const profundidade = (ex.profundidade as number) || 0
      dimMap = { frente: comprimento, fundo: comprimento, esquerda: profundidade, direita: profundidade }
      acabs = {
        frente: item.acabamento_frente || '', fundo: item.acabamento_fundo || '',
        esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '',
      }
      break
    }
    case 'pia_retangular': {
      const largura = (ex.largura as number) || 0
      const profundidade = (ex.profundidade as number) || 0
      dimMap = { frente: largura, fundo: largura, esquerda: profundidade, direita: profundidade }
      acabs = {
        frente: item.acabamento_frente || '', fundo: item.acabamento_fundo || '',
        esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '',
      }
      break
    }
    case 'lavatorio_extensao': {
      const compTampo = (ex.comp_tampo as number) || 0
      const compExtensao = (ex.comp_extensao as number) || 0
      const prof = (ex.profundidade as number) || 0
      const totalWidth = compTampo + compExtensao
      dimMap = { frente: totalWidth, fundo: totalWidth, esquerda: prof, direita: prof }
      acabs = {
        frente: item.acabamento_frente || '', fundo: item.acabamento_fundo || '',
        esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '',
      }
      break
    }
    case 'soleira': {
      const comp = (ex.comprimento as number) || 0
      const larg = (ex.largura as number) || 0
      dimMap = { frente: comp, fundo: comp, esquerda: larg, direita: larg }
      acabs = {
        frente: item.acabamento_frente || '', fundo: item.acabamento_fundo || '',
        esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '',
      }
      break
    }
    case 'nicho': {
      const l = (ex.largura as number) || 0
      const a = (ex.altura as number) || 0
      dimMap = { esquerda: a, direita: a, superior: l, inferior: l }
      acabs = {
        esquerda: item.acabamento_esquerda || '',
        direita: item.acabamento_direita || '',
        superior: (ex.acabamento_superior as string) || '',
        inferior: (ex.acabamento_inferior as string) || '',
      }
      break
    }
    case 'pia_l': {
      const seg1c = (ex.seg1_comprimento as number) || 0
      const seg1p = (ex.seg1_profundidade as number) || 0
      const seg2c = (ex.seg2_comprimento as number) || 0
      const seg2p = (ex.seg2_profundidade as number) || 0
      dimMap = { esquerda: seg1p, direita: seg2p, frente_seg1: seg1c, frente_seg2: seg2c, fundo: seg1c }
      acabs = {
        esquerda: item.acabamento_esquerda || '',
        direita: item.acabamento_direita || '',
        fundo: item.acabamento_fundo || '',
        frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
        frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
      }
      break
    }
    case 'pia_u': {
      const seg1c = (ex.seg1_comprimento as number) || 0
      const seg1p = (ex.seg1_profundidade as number) || 0
      const seg2c = (ex.seg2_comprimento as number) || 0
      const seg3c = (ex.seg3_comprimento as number) || 0
      const seg3p = (ex.seg3_profundidade as number) || 0
      dimMap = { esquerda: seg1p, direita: seg3p, frente_seg1: seg1c, frente_seg2: seg2c, frente_seg3: seg3c, fundo: seg2c }
      acabs = {
        esquerda: item.acabamento_esquerda || '',
        direita: item.acabamento_direita || '',
        fundo: item.acabamento_fundo || '',
        frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
        frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
        frente_seg3: (ex.acabamento_frente_seg3 as string) || '',
      }
      break
    }
    case 'escada': {
      const n = (ex.num_degraus as number) || 0
      const lp = (ex.largura_piso as number) || 0
      const comprimentoLateral = n * (lp / 100)
      dimMap = { esquerda: comprimentoLateral, direita: comprimentoLateral }
      acabs = { esquerda: item.acabamento_esquerda || '', direita: item.acabamento_direita || '' }
      break
    }
    default:
      return 0
  }

  let ml = 0
  for (const [lat, len] of Object.entries(dimMap)) {
    if (len > 0 && acabs[lat]) ml += len
  }
  return ml
}

// metros lineares de acabamento — soma, por item, o comprimento de cada
// lateral que tem algum acabamento marcado (inclui a metragem da saia, já
// que a saia força acabamento meia_esquadria na lateral onde foi ativada).
// Funciona para os 9 desenhos; lê dados_extras para os desenhos cuja
// dimensão real não fica salva em largura/altura.
export function mlAcabamentoItens(itens: ItemAcabamentoLinear[]): number {
  return itens.reduce((s, i) => s + mlAcabamentoItem(i) * (i.quantidade || 1), 0)
}

// Capacidade diária média: soma tudo, divide pelos DIAS DISTINTOS com
// apontamento (não pelo total de dias do período) — não dilui a média em
// dias sem nenhuma produção registrada.
export function mediaDiariaPCP(registros: { quantidade: number; data: string }[]): number {
  if (registros.length === 0) return 0
  const porDia: Record<string, number> = {}
  for (const r of registros) porDia[r.data] = (porDia[r.data] || 0) + r.quantidade
  const dias = Object.keys(porDia)
  const total = Object.values(porDia).reduce((s, v) => s + v, 0)
  return dias.length > 0 ? total / dias.length : 0
}

// Taxa média de custo (R$/m² ou R$/ml, conforme o cargo) entre os
// funcionários ativos desse cargo que já têm a taxa cadastrada. Usada pra
// estimar o custo real de mão de obra de um orçamento ainda não fechado
// (sem saber ainda quem exatamente vai executar o serviço).
export function taxaMediaPorCargo(
  funcionarios: { cargo: string; ativo: boolean; valor_metro_linear?: number | null }[],
  cargo: string
): number {
  const comTaxa = funcionarios.filter(f => f.ativo && f.cargo === cargo && (f.valor_metro_linear || 0) > 0)
  if (comTaxa.length === 0) return 0
  return comTaxa.reduce((s, f) => s + (f.valor_metro_linear || 0), 0) / comTaxa.length
}

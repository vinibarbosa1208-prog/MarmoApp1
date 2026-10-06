import { apiSupabase as supabase } from '@/lib/api-auth'
import { mlAcabamentoItens } from '@/lib/utils'
import type { EtapaProducao } from './pessoas'
import { quantidadeSistema, unidadeDaEtapa, type ItemParaQuantidade } from './quantidade-sistema'

// Registro de produção por peça — o caminho único que a ficha semanal e o
// modal "Registrar Corte/Acabamento" da Fila de Serviços usam.
//
// Antes cada tela fazia a sua: a Fila gravava UM apontamento agregado por
// pedido (sem orcamento_item_id) direto do navegador e avançava o
// `producao_status` no próprio componente. Com dois caminhos escrevendo a
// mesma peça, a mesma produção entrava duas vezes. Agora os dois passam por
// aqui: um apontamento por peça, com `orcamento_item_id` preenchido, e o
// índice único parcial `producao_apontamentos_item_etapa_uniq` garante que
// o segundo caminho ATUALIZE o registro existente em vez de criar outro.
//
// Server-only: usa service role (apiSupabase).

export type OrigemRegistro = 'ficha' | 'automatico' | 'manual'

// Campos de orcamento_itens que o helper precisa — a mesma lista em todas
// as rotas, pra ninguém esquecer de selecionar um e zerar um cálculo.
export const SELECT_ITENS_PRODUCAO =
  'id, orcamento_id, descricao, tipo, tipo_peca, ambiente, quantidade, area, largura, altura, ' +
  'acabamento_esquerda, acabamento_direita, acabamento_frente, acabamento_fundo, dados_extras, ' +
  'cortado_em, cortado_por, acabado_em, acabado_por, instalado_em, instalado_por'

export interface ItemProducao extends ItemParaQuantidade {
  id: string
  orcamento_id: string
  descricao: string
  tipo?: string | null
  ambiente?: string | null
  cortado_em?: string | null
  cortado_por?: string | null
  acabado_em?: string | null
  acabado_por?: string | null
  instalado_em?: string | null
  instalado_por?: string | null
}

const CAMPOS_POR_ETAPA: Record<EtapaProducao, { data: string; por: string }> = {
  corte: { data: 'cortado_em', por: 'cortado_por' },
  acabamento: { data: 'acabado_em', por: 'acabado_por' },
  instalacao: { data: 'instalado_em', por: 'instalado_por' },
}

// Próxima etapa da Fila quando todas as peças do pedido terminam a atual.
// Instalação não avança nada aqui: o pedido só vira 'finalizado' por decisão
// do gestor na Fila, depois do fechamento.
const PROXIMO_STATUS: Partial<Record<EtapaProducao, string>> = {
  corte: 'acabamento',
  acabamento: 'aguardando_data',
}

// Espelho de FILA_TO_ETAPA (app/(app)/fila/page.tsx): etapa do Centro de
// Custos correspondente a cada status da Fila.
const STATUS_TO_ETAPA_PROJETO: Record<string, string> = {
  corte: 'producao',
  aguardando_data: 'pronto',
  instalacao: 'agendado',
  finalizado: 'concluido',
}

/** Peças de um pedido que a etapa precisa medir (serviço/frete ficam fora). */
export function itensRelevantes(itens: ItemProducao[], etapa: EtapaProducao): ItemProducao[] {
  if (etapa === 'corte') return itens.filter(i => (i.area || 0) > 0)
  // Mesmo critério de `itensRelevantesAcabamento` na Fila: precisa ter
  // geometria e ao menos um lado com acabamento marcado.
  return itens.filter(i => mlAcabamentoItens([i]) > 0)
}

export function itensPendentes(itens: ItemProducao[], etapa: EtapaProducao): ItemProducao[] {
  const campo = CAMPOS_POR_ETAPA[etapa].data as keyof ItemProducao
  return itensRelevantes(itens, etapa).filter(i => !i[campo])
}

export interface ApontamentoExistente {
  id: string
  data: string
  quantidade: number
  funcionario_id: string | null
  status: string
}

/**
 * Apontamento vivo (não rejeitado) de uma peça numa etapa — é o que o
 * índice único protege. A tela usa isso pra mostrar
 * "já registrada em DD/MM por Fulano".
 */
export async function apontamentoDaPeca(
  marmoraria_id: string,
  orcamento_item_id: string,
  etapa: EtapaProducao
): Promise<ApontamentoExistente | null> {
  const { data, error } = await supabase
    .from('producao_apontamentos')
    .select('id, data, quantidade, funcionario_id, status')
    .eq('marmoraria_id', marmoraria_id)
    .eq('orcamento_item_id', orcamento_item_id)
    .eq('etapa', etapa)
    .neq('status', 'rejeitado')
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export interface RegistrarPecaInput {
  marmoraria_id: string
  orcamento_id: string
  item: ItemProducao
  etapa: EtapaProducao
  funcionario_id: string
  /** data do bloco da ficha — NUNCA a data da digitação */
  data: string
  /** número da ficha; na Fila, o número do sistema */
  quantidade: number
  origem: OrigemRegistro
  status: 'pendente' | 'aprovado'
  tipo_acabamento?: 'reto' | 'meia_esquadria' | null
  valor_metro_linear_aplicado?: number | null
  valor_calculado?: number | null
}

export interface RegistrarPecaResultado {
  id: string
  /** false quando atualizou um apontamento que já existia pra essa peça */
  criado: boolean
}

/**
 * Grava (ou atualiza) o apontamento de uma peça e marca a peça como feita
 * em `orcamento_itens`, igual ao modal da Fila. NÃO avança o pedido —
 * chame `avancarSeEtapaCompleta` depois de registrar o lote todo, pra o
 * pedido não avançar no meio de um lançamento de várias peças.
 */
export async function registrarPeca(input: RegistrarPecaInput): Promise<RegistrarPecaResultado> {
  const {
    marmoraria_id, orcamento_id, item, etapa, funcionario_id, data, quantidade,
    origem, status, tipo_acabamento, valor_metro_linear_aplicado, valor_calculado,
  } = input

  const payload = {
    marmoraria_id,
    orcamento_id,
    orcamento_item_id: item.id,
    funcionario_id,
    etapa,
    quantidade,
    quantidade_sistema: quantidadeSistema(item, etapa),
    unidade: unidadeDaEtapa(etapa),
    data,
    origem,
    status,
    tipo_acabamento: etapa === 'acabamento' ? (tipo_acabamento ?? null) : null,
    peca_descricao: item.descricao ?? null,
    valor_metro_linear_aplicado: valor_metro_linear_aplicado ?? null,
    valor_calculado: valor_calculado ?? null,
    is_retroativo: false,
  }

  const existente = await apontamentoDaPeca(marmoraria_id, item.id, etapa)

  let id: string
  if (existente) {
    // Segundo caminho na mesma peça (ex: a Fila depois da ficha): atualiza
    // data, responsável e quantidade em vez de duplicar a produção.
    const { data: row, error } = await supabase
      .from('producao_apontamentos')
      .update(payload)
      .eq('id', existente.id)
      .select('id')
      .single()
    if (error) throw error
    id = row.id
  } else {
    const { data: row, error } = await supabase
      .from('producao_apontamentos')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw error
    id = row.id
  }

  const campos = CAMPOS_POR_ETAPA[etapa]
  const { error: itemErr } = await supabase
    .from('orcamento_itens')
    .update({ [campos.data]: `${data}T12:00:00`, [campos.por]: funcionario_id })
    .eq('id', item.id)
    .eq('marmoraria_id', marmoraria_id)
  if (itemErr) throw itemErr

  return { id, criado: !existente }
}

/** Desfaz o registro de uma peça (exclusão de linha da ficha). */
export async function desmarcarPeca(
  marmoraria_id: string,
  orcamento_item_id: string,
  etapa: EtapaProducao
): Promise<void> {
  const campos = CAMPOS_POR_ETAPA[etapa]
  const { error } = await supabase
    .from('orcamento_itens')
    .update({ [campos.data]: null, [campos.por]: null })
    .eq('id', orcamento_item_id)
    .eq('marmoraria_id', marmoraria_id)
  if (error) throw error
}

export interface AvancoResultado {
  avancou: boolean
  novoStatus?: string
  pendentes: number
}

/**
 * Avança o `producao_status` do pedido quando ZERO peças ficam pendentes na
 * etapa — a mesma regra que o modal da Fila aplicava dentro do componente,
 * agora compartilhada. Também registra a etapa no Centro de Custos
 * (projeto_etapas), igual a `avancarConfirmado` fazia via /api/projetos.
 *
 * Só avança "pra frente": se o pedido já passou dessa etapa (ex: a ficha
 * está sendo lançada retroativamente numa semana antiga), não puxa o pedido
 * de volta.
 */
export async function avancarSeEtapaCompleta(
  marmoraria_id: string,
  orcamento_id: string,
  etapa: EtapaProducao
): Promise<AvancoResultado> {
  const novoStatus = PROXIMO_STATUS[etapa]
  if (!novoStatus) return { avancou: false, pendentes: 0 }

  const { data: itens, error } = await supabase
    .from('orcamento_itens')
    .select(SELECT_ITENS_PRODUCAO)
    .eq('orcamento_id', orcamento_id)
  if (error) throw error

  const lista = (itens ?? []) as unknown as ItemProducao[]
  const relevantes = itensRelevantes(lista, etapa)
  const pendentes = itensPendentes(lista, etapa)

  // Pedido sem nenhuma peça mensurável nessa etapa não "completa" nada por
  // causa de um lançamento de ficha — quem avança esse caso é a Fila, que
  // já trata isso explicitamente.
  if (relevantes.length === 0 || pendentes.length > 0) {
    return { avancou: false, pendentes: pendentes.length }
  }

  const { data: orc, error: orcErr } = await supabase
    .from('orcamentos')
    .select('id, producao_status')
    .eq('id', orcamento_id)
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()
  if (orcErr) throw orcErr
  if (!orc) return { avancou: false, pendentes: 0 }

  // Só avança se o pedido ainda está na etapa que acabou de fechar.
  if ((orc.producao_status || 'comercial') !== etapa) {
    return { avancou: false, pendentes: 0 }
  }

  const { error: updErr } = await supabase
    .from('orcamentos')
    .update({ producao_status: novoStatus, producao_status_atualizado_em: new Date().toISOString() })
    .eq('id', orcamento_id)
    .eq('marmoraria_id', marmoraria_id)
  if (updErr) throw updErr

  await registrarEtapaProjeto(marmoraria_id, orcamento_id, novoStatus)

  return { avancou: true, novoStatus, pendentes: 0 }
}

/**
 * Centro de Custos: fecha a etapa ativa do projeto e abre a nova. Mesma
 * lógica de POST /api/projetos/[id]/etapas — replicada aqui em vez de um
 * fetch pra si mesmo, que não funciona sem repassar o cookie de sessão.
 * Pedido sem projeto associado é ignorado sem erro.
 */
async function registrarEtapaProjeto(marmoraria_id: string, orcamento_id: string, statusFila: string) {
  const etapaProjeto = STATUS_TO_ETAPA_PROJETO[statusFila]
  if (!etapaProjeto) return

  const { data: projeto } = await supabase
    .from('projetos')
    .select('id')
    .eq('marmoraria_id', marmoraria_id)
    .eq('orcamento_id', orcamento_id)
    .maybeSingle()
  if (!projeto) return

  const agora = new Date().toISOString()

  const { data: ativas } = await supabase
    .from('projeto_etapas')
    .select('id, entrada_em, etapa')
    .eq('projeto_id', projeto.id)
    .is('saida_em', null)

  const atual = ativas?.[0]
  if (atual) {
    if (atual.etapa === etapaProjeto) return // já está nessa etapa
    const dias = Math.round((new Date(agora).getTime() - new Date(atual.entrada_em).getTime()) / 86400000)
    await supabase.from('projeto_etapas').update({ saida_em: agora, dias_na_etapa: dias }).eq('id', atual.id)
  }

  await supabase.from('projeto_etapas').insert({ projeto_id: projeto.id, etapa: etapaProjeto, entrada_em: agora })

  if (etapaProjeto === 'concluido') {
    await supabase
      .from('projetos')
      .update({ status: 'concluido', data_conclusao: agora.split('T')[0] })
      .eq('id', projeto.id)
  }
}

import { areaCortadaItens, mlAcabamentoItens } from '@/lib/utils'
import type { EtapaProducao } from './pessoas'

// "ml sistema" / "m2 sistema" — quanto o próprio orçamento diz que essa
// peça tem, pra comparar lado a lado com o número que a pessoa escreveu na
// ficha. Quem vale no lançamento é SEMPRE o número da ficha; isso aqui só
// alimenta o alerta de divergência (⚠ acima de 10%) e a coluna
// `quantidade_sistema` do apontamento, que é a ferramenta de treino das
// primeiras semanas.

// Campos mínimos que `mlAcabamentoItens`/`areaCortadaItens` precisam. Fica
// explícito aqui pra as rotas saberem o que selecionar do banco.
export type ItemParaQuantidade = Parameters<typeof mlAcabamentoItens>[0][number] & {
  area?: number | null
  quantidade?: number | null
}

export function unidadeDaEtapa(etapa: EtapaProducao): 'm2' | 'ml' {
  return etapa === 'corte' ? 'm2' : 'ml'
}

export function quantidadeSistema(item: ItemParaQuantidade, etapa: EtapaProducao): number {
  if (etapa === 'corte') return areaCortadaItens([{ area: item.area ?? 0, quantidade: item.quantidade ?? 1 }])
  // Acabamento e instalação medem a mesma coisa: o comprimento das bordas
  // trabalhadas da peça. O portal do instalador nunca calculou isso (o
  // instalador digitava o metro na mão), então o ml de acabamento é a
  // melhor referência que o sistema tem pra conferir a ficha de instalação
  // também — e é só referência, não entra em nenhum pagamento.
  return mlAcabamentoItens([item])
}

/**
 * Divergência relativa entre ficha e sistema. Acima de 10% a tela mostra
 * ⚠ em amarelo, sem bloquear o lançamento.
 */
export const LIMITE_DIVERGENCIA = 0.1

export function divergencia(daFicha: number, doSistema: number | null | undefined): number | null {
  if (!doSistema || doSistema <= 0) return null
  return Math.abs(daFicha - doSistema) / doSistema
}

export function divergenteDemais(daFicha: number, doSistema: number | null | undefined): boolean {
  const d = divergencia(daFicha, doSistema)
  return d !== null && d > LIMITE_DIVERGENCIA
}

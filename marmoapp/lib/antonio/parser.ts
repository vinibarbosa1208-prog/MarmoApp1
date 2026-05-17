import { orcamentoTotal } from './calculator'

export interface OrcItem {
  tipo: 'material' | 'servico' | 'frete' | 'outro'
  descricao: string
  quantidade: number
  preco_unitario: number
}

export interface OrcParsed {
  descricao: string
  cliente_nome: string | null
  itens: OrcItem[]
  mao_obra: number
  observacoes: string | null
  total: number
}

const MARKER = '---ORCAMENTO---'

/** Extrai o bloco ---ORCAMENTO--- do texto do Claude e parseia o JSON */
export function parseOrcamento(text: string): OrcParsed | null {
  if (!text.includes(MARKER)) return null
  const part = text.split(MARKER)[1].trim()
  const match = part.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0])
    const itens: OrcItem[] = (raw.itens || []).map((i: Partial<OrcItem>) => ({
      tipo: i.tipo || 'outro',
      descricao: i.descricao || '',
      quantidade: Number(i.quantidade) || 0,
      preco_unitario: Number(i.preco_unitario) || 0,
    }))
    const mao_obra = Number(raw.mao_obra) || 0
    return {
      descricao: raw.descricao || 'Orçamento gerado pelo Antônio',
      cliente_nome: raw.cliente_nome || null,
      itens,
      mao_obra,
      observacoes: raw.observacoes || null,
      total: orcamentoTotal(itens, mao_obra),
    }
  } catch {
    return null
  }
}

/** Remove o bloco ---ORCAMENTO--- do texto para exibição ao usuário */
export function stripOrcamento(text: string): string {
  if (!text.includes(MARKER)) return text
  return text.split(MARKER)[0].trim()
}

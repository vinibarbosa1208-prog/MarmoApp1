/** Lê os blocos ---NOME--- {json} que o Antônio acrescenta ao final das respostas. */

export const NOMES_MARCADORES = ['PREORCAMENTO', 'MEDICAO', 'PERDIDO', 'HUMANO', 'LEAD'] as const
export type NomeMarcador = (typeof NOMES_MARCADORES)[number]

export interface RespostaSeparada {
  texto: string
  marcadores: Partial<Record<NomeMarcador, Record<string, unknown>>>
}

const RE = /---(PREORCAMENTO|MEDICAO|PERDIDO|HUMANO|LEAD|ORCAMENTO)---/

/** Separa o texto que vai para o cliente dos marcadores. Marcador com JSON inválido é ignorado. */
export function separarResposta(bruto: string): RespostaSeparada {
  const partes = bruto.split(RE)
  const texto = (partes[0] || '').trim()
  const marcadores: RespostaSeparada['marcadores'] = {}

  for (let i = 1; i < partes.length; i += 2) {
    const nome = partes[i] as NomeMarcador
    const corpo = partes[i + 1] || ''
    const json = corpo.match(/\{[\s\S]*\}/)
    if (!json || !(NOMES_MARCADORES as readonly string[]).includes(nome)) continue
    try {
      marcadores[nome] = JSON.parse(json[0])
    } catch {
      // ignora bloco malformado
    }
  }
  return { texto, marcadores }
}

export interface ItemPreOrcamento {
  descricao: string
  tipo: string
  quantidade: number
  unidade?: string
  preco_unitario: number
}

export function lerItensPreOrcamento(m: Record<string, unknown> | undefined): ItemPreOrcamento[] {
  const itens = Array.isArray(m?.itens) ? (m!.itens as Record<string, unknown>[]) : []
  return itens
    .map(i => ({
      descricao: String(i.descricao || ''),
      tipo: String(i.tipo || 'outro'),
      quantidade: Number(i.quantidade) || 0,
      unidade: i.unidade ? String(i.unidade) : undefined,
      preco_unitario: Number(i.preco_unitario) || 0,
    }))
    .filter(i => i.descricao && i.quantidade > 0 && i.preco_unitario > 0)
}

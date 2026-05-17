interface MaterialKB {
  nome: string
  unidade: string
  preco_padrao?: number
  preco?: number
}

interface ServicoKB {
  nome: string
  preco_padrao?: number
}

interface ClienteKB {
  nome: string
}

export interface Catalogo {
  marmoraria: { id: string; nome: string }
  materiais?: MaterialKB[]
  servicos?: ServicoKB[]
  clientes?: ClienteKB[]
}

/** Constrói o contexto do catálogo para injetar no system prompt do Claude */
export function buildKnowledgeBase(catalogo: Catalogo): string {
  const { marmoraria, materiais = [], servicos = [], clientes = [] } = catalogo

  const matLines = materiais.length > 0
    ? materiais
        .map(m => `  - ${m.nome} (${m.unidade}): R$ ${m.preco_padrao ?? m.preco ?? 0}/un`)
        .join('\n')
    : '  (nenhum cadastrado)'

  const svcLines = servicos.length > 0
    ? servicos.map(s => `  - ${s.nome}: R$ ${s.preco_padrao ?? 0}`).join('\n')
    : '  (nenhum cadastrado)'

  const cliLines = clientes.length > 0
    ? clientes.map(c => `  - ${c.nome}`).join('\n')
    : '  (nenhum cadastrado)'

  return `
CATÁLOGO DA MARMORARIA "${marmoraria.nome}":

Materiais disponíveis:
${matLines}

Serviços disponíveis:
${svcLines}

Clientes cadastrados:
${cliLines}
`.trim()
}

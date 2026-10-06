// "Pessoa" da ficha semanal de produção.
//
// Quem acaba e também instala tem dois cadastros em `funcionarios` (cargo e
// forma de pagamento diferentes) mas é uma pessoa só e recebe UMA ficha de
// papel. `funcionarios.pessoa_id` liga o cadastro secundário ao principal;
// a pessoa é `coalesce(pessoa_id, id)`.
//
// Esse agrupamento é usado em três lugares — PDF da ficha, tela de
// lançamento e indicadores de capacidade — então vive aqui, não dentro de
// uma tela.

export const CARGOS_FICHA = ['serrador', 'acabador', 'instalador'] as const
export type CargoFicha = (typeof CARGOS_FICHA)[number]

export type EtapaProducao = 'corte' | 'acabamento' | 'instalacao'

// Qual cargo executa cada etapa. O `funcionario_id` gravado no apontamento
// é sempre o cadastro correspondente à etapa (instalação usa o cadastro de
// instalador; corte e acabamento usam o cadastro interno), senão o valor
// por metro do instalador não seria encontrado no pagamento.
export const CARGO_DA_ETAPA: Record<EtapaProducao, CargoFicha> = {
  corte: 'serrador',
  acabamento: 'acabador',
  instalacao: 'instalador',
}

export interface FuncionarioPessoa {
  id: string
  nome: string
  cargo: string
  pessoa_id?: string | null
  ativo?: boolean
  valor_diaria?: number | null
  valor_metro_linear?: number | null
}

export interface Pessoa {
  /** coalesce(pessoa_id, id) — identidade estável da pessoa */
  pessoaId: string
  /** nome do cadastro principal */
  nome: string
  cadastros: FuncionarioPessoa[]
  /** cadastro a usar como funcionario_id em cada etapa que a pessoa faz */
  cadastroPorEtapa: Partial<Record<EtapaProducao, FuncionarioPessoa>>
  /**
   * Modelo da ficha impressa. Serrador puro leva o modelo de corte
   * (Cliente · Peça · Medidas C × L); quem acaba e/ou instala leva o de
   * acabamento (Cliente · Peça · Metros lineares · Tipo). Quem for serrador
   * E acabador cai no modelo de acabamento — é o que ele anota na maior
   * parte dos dias, e o corte dele continua lançável pela Fila.
   */
  modelo: 'corte' | 'acabamento'
}

export function pessoaIdDe(f: FuncionarioPessoa): string {
  return f.pessoa_id || f.id
}

/**
 * Agrupa cadastros em pessoas. Só entram cargos que recebem ficha
 * (serrador, acabador, instalador) e, por padrão, só cadastros ativos —
 * ajudantes (cargo `outro`) e medidor ficam de fora.
 *
 * Ordena por nome pra o PDF e os seletores saírem sempre na mesma ordem.
 */
export function agruparPessoas(
  funcionarios: FuncionarioPessoa[],
  opts: { incluirInativos?: boolean } = {}
): Pessoa[] {
  const doFicha = funcionarios.filter(f =>
    (CARGOS_FICHA as readonly string[]).includes(f.cargo) &&
    (opts.incluirInativos || f.ativo !== false)
  )

  const porPessoa = new Map<string, FuncionarioPessoa[]>()
  for (const f of doFicha) {
    const pid = pessoaIdDe(f)
    const lista = porPessoa.get(pid) ?? []
    lista.push(f)
    porPessoa.set(pid, lista)
  }

  const pessoas: Pessoa[] = []
  for (const [pessoaId, cadastros] of porPessoa) {
    // O nome vem do cadastro principal; se ele estiver inativo (ou filtrado
    // fora), cai no primeiro cadastro restante pra pessoa não ficar sem nome.
    const principal = cadastros.find(c => c.id === pessoaId) ?? cadastros[0]

    const cadastroPorEtapa: Partial<Record<EtapaProducao, FuncionarioPessoa>> = {}
    for (const etapa of Object.keys(CARGO_DA_ETAPA) as EtapaProducao[]) {
      const cad = cadastros.find(c => c.cargo === CARGO_DA_ETAPA[etapa])
      if (cad) cadastroPorEtapa[etapa] = cad
    }

    const soSerrador = cadastros.every(c => c.cargo === 'serrador')
    pessoas.push({
      pessoaId,
      nome: principal.nome,
      cadastros,
      cadastroPorEtapa,
      modelo: soSerrador ? 'corte' : 'acabamento',
    })
  }

  return pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Etapas que essa pessoa pode lançar na ficha, na ordem do processo. */
export function etapasDaPessoa(p: Pessoa): EtapaProducao[] {
  return (['corte', 'acabamento', 'instalacao'] as EtapaProducao[])
    .filter(e => !!p.cadastroPorEtapa[e])
}

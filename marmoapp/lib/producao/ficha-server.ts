import { apiSupabase as supabase } from '@/lib/api-auth'
import { agruparPessoas, type FuncionarioPessoa, type Pessoa, type EtapaProducao } from './pessoas'
import { ehSemanaValida, segundaDaSemana } from './semana'

// Carga e validação do que a ficha semanal precisa do banco. Server-only.

export const SELECT_FUNCIONARIO_PESSOA =
  'id, nome, cargo, pessoa_id, ativo, valor_diaria, valor_metro_linear'

export async function carregarPessoas(
  marmoraria_id: string,
  opts: { incluirInativos?: boolean } = {}
): Promise<Pessoa[]> {
  const { data, error } = await supabase
    .from('funcionarios')
    .select(SELECT_FUNCIONARIO_PESSOA)
    .eq('marmoraria_id', marmoraria_id)
    .order('nome')
  if (error) throw error
  return agruparPessoas((data ?? []) as FuncionarioPessoa[], opts)
}

export async function buscarPessoa(marmoraria_id: string, pessoaId: string): Promise<Pessoa | null> {
  // Inclui inativos ao buscar uma pessoa específica: o histórico de semanas
  // passadas tem que continuar abrindo depois de alguém sair da empresa.
  const pessoas = await carregarPessoas(marmoraria_id, { incluirInativos: true })
  return pessoas.find(p => p.pessoaId === pessoaId) ?? null
}

/** 400 amigável em vez de uma consulta com intervalo sem sentido. */
export function validarSemana(semana: string | null): { ok: true; semana: string } | { ok: false; erro: string } {
  if (!semana) return { ok: false, erro: 'Parâmetro semana obrigatório (segunda-feira, YYYY-MM-DD)' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) return { ok: false, erro: 'Semana em formato inválido (use YYYY-MM-DD)' }
  if (!ehSemanaValida(semana)) {
    return { ok: false, erro: `A semana deve começar numa segunda-feira (seria ${segundaDaSemana(semana)})` }
  }
  return { ok: true, semana }
}

export interface FichaProducao {
  id: string
  pessoa_id: string
  semana_inicio: string
  status: 'aberta' | 'fechada'
  fechada_em: string | null
  fechada_por: string | null
  arquivo_url: string | null
}

/**
 * A ficha da semana existe sempre que a tela abre, mesmo que o cron da
 * segunda não tenha rodado ainda — a ficha de papel já está em uso, não
 * pode travar o lançamento esperando o cron.
 */
export async function garantirFicha(
  marmoraria_id: string,
  pessoaId: string,
  semana_inicio: string
): Promise<FichaProducao> {
  const { data: existente, error } = await supabase
    .from('fichas_producao')
    .select('id, pessoa_id, semana_inicio, status, fechada_em, fechada_por, arquivo_url')
    .eq('marmoraria_id', marmoraria_id)
    .eq('pessoa_id', pessoaId)
    .eq('semana_inicio', semana_inicio)
    .maybeSingle()
  if (error) throw error
  if (existente) return existente as FichaProducao

  const { data: criada, error: insErr } = await supabase
    .from('fichas_producao')
    .insert({ marmoraria_id, pessoa_id: pessoaId, semana_inicio })
    .select('id, pessoa_id, semana_inicio, status, fechada_em, fechada_por, arquivo_url')
    // Corrida com o cron (ou com duas abas): a unicidade (pessoa_id,
    // semana_inicio) recusa o segundo insert — relê em vez de estourar.
    .maybeSingle()
  if (insErr) {
    const { data: relida } = await supabase
      .from('fichas_producao')
      .select('id, pessoa_id, semana_inicio, status, fechada_em, fechada_por, arquivo_url')
      .eq('marmoraria_id', marmoraria_id)
      .eq('pessoa_id', pessoaId)
      .eq('semana_inicio', semana_inicio)
      .maybeSingle()
    if (relida) return relida as FichaProducao
    throw insErr
  }
  return criada as FichaProducao
}

/**
 * Valor por metro linear a aplicar numa instalação: primeiro a tabela por
 * tipo de peça do instalador (Fase 12), senão o valor do cadastro. Em obra
 * avulsa não há tipo de peça, então é sempre o valor fixo.
 */
export async function valorMetroInstalacao(
  marmoraria_id: string,
  instaladorId: string,
  tipo_peca: string | null
): Promise<number | null> {
  if (tipo_peca) {
    const { data } = await supabase
      .from('funcionario_valores_peca')
      .select('valor_metro_linear')
      .eq('marmoraria_id', marmoraria_id)
      .eq('funcionario_id', instaladorId)
      .eq('tipo_peca', tipo_peca)
      .maybeSingle()
    if (data?.valor_metro_linear && Number(data.valor_metro_linear) > 0) return Number(data.valor_metro_linear)
  }

  const { data: func } = await supabase
    .from('funcionarios')
    .select('valor_metro_linear')
    .eq('id', instaladorId)
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()

  const valor = Number(func?.valor_metro_linear ?? 0)
  return valor > 0 ? valor : null
}

/**
 * Status com que cada etapa da ficha entra: instalação vai pra Aprovações
 * do fechamento de sexta (gera pagamento); corte e acabamento já entram
 * aprovados, porque não geram pagamento — são pagos por diária.
 */
export function statusDaEtapa(etapa: EtapaProducao): 'pendente' | 'aprovado' {
  return etapa === 'instalacao' ? 'pendente' : 'aprovado'
}

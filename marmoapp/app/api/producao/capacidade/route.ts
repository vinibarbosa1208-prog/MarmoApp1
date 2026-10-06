import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { areaCortadaItens, mlAcabamentoItens } from '@/lib/utils'
import {
  JANELA_SEMANAS, capacidadeDoTime, carteiraPendente, custoPorMlInstalado, custoPorUnidade,
  fatorMEsugerido, filaPorEtapa, gargalo, janelaDeSemanas, prazoEstimado, produtividadePorPessoa,
  vendidoProduzidoEntregue,
  type ApontamentoCapacidade, type ItemCarteira, type PresencaCapacidade,
} from '@/lib/capacidade'
import { SELECT_ITENS_PRODUCAO, type ItemProducao } from '@/lib/producao/registrar-etapa'
import { carregarPessoas } from '@/lib/producao/ficha-server'
import { isoLocal } from '@/lib/producao/semana'

// Indicadores de capacidade produtiva — tudo calculado no servidor porque
// precisa varrer apontamentos, presenças e a carteira inteira de peças, o
// que não cabe no que a tela já carrega. A conta em si fica em
// lib/capacidade.ts (funções puras, testáveis à mão numa planilha).

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semanas = Number(req.nextUrl.searchParams.get('semanas')) || JANELA_SEMANAS
    const janela = janelaDeSemanas(semanas)

    // Mês de referência pro Vendido × Produzido × Entregue (padrão: o atual)
    const mesRef = req.nextUrl.searchParams.get('mes') // 'YYYY-MM'
    const agora = new Date()
    const [anoRef, mes0Ref] = mesRef && /^\d{4}-\d{2}$/.test(mesRef)
      ? [Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7)) - 1]
      : [agora.getFullYear(), agora.getMonth()]
    const periodoMes = {
      inicio: isoLocal(new Date(anoRef, mes0Ref, 1)),
      fim: isoLocal(new Date(anoRef, mes0Ref + 1, 0)),
    }

    const [{ data: marmoraria }, pessoas] = await Promise.all([
      supabase.from('marmorarias').select('fator_meia_esquadria').eq('id', marmoraria_id).maybeSingle(),
      // Inclui inativos: a produção de quem saiu no meio da janela ainda
      // conta no que a fábrica entregou (a capacidade do TIME filtra ativos
      // depois, via `pessoas.cadastros[].ativo`).
      carregarPessoas(marmoraria_id, { incluirInativos: true }),
    ])
    const fatorME = Number(marmoraria?.fator_meia_esquadria ?? 1) || 1

    const inicioConsulta = janela.inicio < periodoMes.inicio ? janela.inicio : periodoMes.inicio
    const fimConsulta = janela.fim > periodoMes.fim ? janela.fim : periodoMes.fim

    const [apontRes, presRes, carteiraOrcRes, vendidosRes] = await Promise.all([
      supabase
        .from('producao_apontamentos')
        .select('etapa, data, quantidade, tipo_acabamento, funcionario_id, status, valor_calculado')
        .eq('marmoraria_id', marmoraria_id)
        .neq('status', 'rejeitado')
        .gte('data', inicioConsulta)
        .lte('data', fimConsulta),
      supabase
        .from('funcionario_presencas')
        .select('funcionario_id, data, presente, valor_diaria')
        .eq('marmoraria_id', marmoraria_id)
        .gte('data', inicioConsulta)
        .lte('data', fimConsulta),
      // Carteira: pedidos aprovados que ainda não finalizaram.
      supabase
        .from('orcamentos')
        .select('id')
        .eq('marmoraria_id', marmoraria_id)
        .eq('status', 'aprovado')
        .or('producao_status.is.null,producao_status.neq.finalizado'),
      // Vendido do mês, por data_fechamento.
      supabase
        .from('orcamentos')
        .select('id')
        .eq('marmoraria_id', marmoraria_id)
        .eq('status', 'aprovado')
        .gte('data_fechamento', periodoMes.inicio)
        .lte('data_fechamento', periodoMes.fim),
    ])
    if (apontRes.error) throw apontRes.error
    if (presRes.error) throw presRes.error
    if (carteiraOrcRes.error) throw carteiraOrcRes.error
    if (vendidosRes.error) throw vendidosRes.error

    const apontamentos = (apontRes.data ?? []).map(a => ({
      ...a,
      quantidade: Number(a.quantidade ?? 0),
    })) as ApontamentoCapacidade[]
    const presencas = (presRes.data ?? []) as PresencaCapacidade[]

    // ── Carteira ───────────────────────────────────────────────────
    const carteiraOrcIds = (carteiraOrcRes.data ?? []).map(o => o.id)
    let itensCarteira: ItemCarteira[] = []
    if (carteiraOrcIds.length) {
      const itens = await buscarItens(marmoraria_id, carteiraOrcIds)
      itensCarteira = itens
        .filter(i => (i.tipo ?? 'material') === 'material')
        .map(i => ({
          orcamento_id: i.orcamento_id,
          area_total: areaCortadaItens([{ area: i.area ?? 0, quantidade: i.quantidade ?? 1 }]),
          ml: mlAcabamentoItens([i]),
          cortado: !!i.cortado_em,
          acabado: !!i.acabado_em,
          instalado: !!i.instalado_em,
        }))
    }
    const carteira = carteiraPendente(itensCarteira)

    // ── Vendido do mês ─────────────────────────────────────────────
    const vendidosIds = (vendidosRes.data ?? []).map(o => o.id)
    let vendido = { m2: 0, ml: 0 }
    if (vendidosIds.length) {
      const itens = (await buscarItens(marmoraria_id, vendidosIds)).filter(i => (i.tipo ?? 'material') === 'material')
      vendido = {
        m2: areaCortadaItens(itens.map(i => ({ area: i.area ?? 0, quantidade: i.quantidade ?? 1 }))),
        ml: mlAcabamentoItens(itens),
      }
    }

    // ── Indicadores ────────────────────────────────────────────────
    const produtividades = produtividadePorPessoa(pessoas, apontamentos, presencas, janela, fatorME)
    // Capacidade do TIME conta só quem está ativo hoje — quem saiu não
    // entrega mais nada amanhã, mesmo tendo produzido na janela.
    const pessoasAtivas = new Set(
      pessoas.filter(p => p.cadastros.some(c => c.ativo !== false)).map(p => p.pessoaId)
    )
    const capacidade = capacidadeDoTime(produtividades.filter(p => pessoasAtivas.has(p.pessoaId)))
    const filas = filaPorEtapa(carteira, capacidade)

    return NextResponse.json({
      janela,
      semanas,
      fator_meia_esquadria: fatorME,
      fator_me_sugerido: fatorMEsugerido(apontamentos.filter(a => a.data >= janela.inicio && a.data <= janela.fim)),
      produtividades,
      capacidade,
      carteira,
      filas,
      gargalo: gargalo(filas),
      prazo: prazoEstimado(filas),
      custos: {
        corte: custoPorUnidade('corte', pessoas, apontamentos, presencas, janela, fatorME),
        acabamento: custoPorUnidade('acabamento', pessoas, apontamentos, presencas, janela, fatorME),
        instalacao: custoPorMlInstalado(apontamentos, janela),
      },
      mes: { periodo: periodoMes, ...vendidoProduzidoEntregue(vendido, apontamentos, periodoMes, fatorME) },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/capacidade] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// `.in()` com centenas de ids estoura o limite de tamanho da URL do
// PostgREST — busca em lotes.
async function buscarItens(marmoraria_id: string, orcamentoIds: string[]): Promise<ItemProducao[]> {
  const LOTE = 100
  const todos: ItemProducao[] = []
  for (let i = 0; i < orcamentoIds.length; i += LOTE) {
    const { data, error } = await supabase
      .from('orcamento_itens')
      .select(SELECT_ITENS_PRODUCAO)
      .eq('marmoraria_id', marmoraria_id)
      .in('orcamento_id', orcamentoIds.slice(i, i + LOTE))
    if (error) throw error
    todos.push(...((data ?? []) as unknown as ItemProducao[]))
  }
  return todos
}

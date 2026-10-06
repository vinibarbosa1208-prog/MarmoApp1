import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import type { EtapaProducao } from '@/lib/producao/pessoas'
import {
  SELECT_ITENS_PRODUCAO, itensRelevantes, type ItemProducao,
} from '@/lib/producao/registrar-etapa'
import { quantidadeSistema, unidadeDaEtapa } from '@/lib/producao/quantidade-sistema'

// Peças de um pedido disponíveis pra lançar numa etapa, já com o
// "ml sistema"/"m2 sistema" calculado — é o número que a tela mostra ao
// lado do campo da ficha pra apontar divergência.
//
// Devolve também as peças já registradas (marcadas), pra a tela avisar
// "já registrada em DD/MM por Fulano" em vez de deixar lançar de novo às
// cegas (o índice único faria o segundo lançamento virar uma atualização).

const ETAPAS_VALIDAS: EtapaProducao[] = ['corte', 'acabamento', 'instalacao']

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const orcamento_id = req.nextUrl.searchParams.get('orcamento_id')
    const etapa = req.nextUrl.searchParams.get('etapa') as EtapaProducao | null
    if (!orcamento_id) return NextResponse.json({ error: 'Parâmetro orcamento_id obrigatório' }, { status: 400 })
    if (!etapa || !ETAPAS_VALIDAS.includes(etapa)) {
      return NextResponse.json({ error: 'Parâmetro etapa inválido' }, { status: 400 })
    }

    const { data: itensRow, error } = await supabase
      .from('orcamento_itens')
      .select(SELECT_ITENS_PRODUCAO)
      .eq('marmoraria_id', marmoraria_id)
      .eq('orcamento_id', orcamento_id)
      .order('ordem')
    if (error) throw error

    // Só peça de pedra: `tipo='material'`. Serviço e frete não se cortam,
    // acabam nem instalam.
    const itens = ((itensRow ?? []) as unknown as ItemProducao[]).filter(i => (i.tipo ?? 'material') === 'material')
    const relevantes = itensRelevantes(itens, etapa)

    // Quem já tem apontamento vivo nessa etapa (pra mostrar "já registrada").
    const ids = relevantes.map(i => i.id)
    let apontamentos: { orcamento_item_id: string | null; data: string; funcionario_id: string | null; quantidade: number }[] = []
    if (ids.length) {
      const { data: aps } = await supabase
        .from('producao_apontamentos')
        .select('orcamento_item_id, data, funcionario_id, quantidade')
        .eq('marmoraria_id', marmoraria_id)
        .eq('etapa', etapa)
        .neq('status', 'rejeitado')
        .in('orcamento_item_id', ids)
      apontamentos = aps ?? []
    }
    const apontPorItem = new Map(apontamentos.map(a => [a.orcamento_item_id, a]))

    const funcIds = [...new Set(apontamentos.map(a => a.funcionario_id).filter((v): v is string => !!v))]
    let nomePorFunc = new Map<string, string>()
    if (funcIds.length) {
      const { data: fs } = await supabase.from('funcionarios').select('id, nome').in('id', funcIds)
      nomePorFunc = new Map((fs ?? []).map(f => [f.id, f.nome]))
    }

    const campoFeito = etapa === 'corte' ? 'cortado_em' : etapa === 'acabamento' ? 'acabado_em' : 'instalado_em'

    const pecas = relevantes.map(i => {
      const ap = apontPorItem.get(i.id)
      return {
        id: i.id,
        descricao: i.descricao,
        ambiente: i.ambiente ?? null,
        tipo_peca: i.tipo_peca ?? null,
        quantidade_sistema: quantidadeSistema(i, etapa),
        unidade: unidadeDaEtapa(etapa),
        // "Já registrada": o apontamento é a fonte da verdade (tem data e
        // quem fez); o campo em orcamento_itens é só o espelho da Fila.
        registrada: ap
          ? {
              data: ap.data,
              quantidade: ap.quantidade,
              funcionario_nome: ap.funcionario_id ? nomePorFunc.get(ap.funcionario_id) ?? null : null,
            }
          : (i[campoFeito as keyof ItemProducao]
              ? { data: String(i[campoFeito as keyof ItemProducao]).slice(0, 10), quantidade: null, funcionario_nome: null }
              : null),
      }
    })

    return NextResponse.json({ pecas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha/pecas] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

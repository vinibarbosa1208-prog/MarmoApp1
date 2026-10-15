import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import type { EtapaProducao } from '@/lib/producao/pessoas'
import { statusDaEtapa } from '@/lib/producao/ficha-server'
import {
  SELECT_ITENS_PRODUCAO, avancarSeEtapaCompleta, registrarPeca, type ItemProducao,
} from '@/lib/producao/registrar-etapa'

// Registro de corte/acabamento pelo modal "Registrar Corte/Acabamento" da
// Fila de Serviços — mesmo caminho da ficha semanal (lib/producao/
// registrar-etapa.ts), pra não duplicar produção quando a mesma peça é
// lançada pelos dois lugares (spec: "os dois caminhos passam a usar o
// mesmo helper e o índice único (orcamento_item_id, etapa)").
//
// A Fila não tem "número da ficha" — usa direto o que o sistema calcula
// pra cada peça (área para corte, ml de acabamento para acabamento).

const ETAPAS_VALIDAS: EtapaProducao[] = ['corte', 'acabamento']

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const orcamento_id = String(body.orcamento_id ?? '')
    const etapa = String(body.etapa ?? '') as EtapaProducao
    const itensIds: string[] = Array.isArray(body.itens_ids) ? body.itens_ids.map(String) : []
    const funcionario_id = String(body.funcionario_id ?? '')
    const data = String(body.data ?? '')

    if (!orcamento_id) return NextResponse.json({ error: 'Pedido obrigatório' }, { status: 400 })
    if (!ETAPAS_VALIDAS.includes(etapa)) return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    if (itensIds.length === 0) return NextResponse.json({ error: 'Selecione ao menos uma peça' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Data inválida' }, { status: 400 })

    const cargoEsperado = etapa === 'corte' ? 'serrador' : 'acabador'
    const { data: funcionario } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', funcionario_id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', cargoEsperado)
      .maybeSingle()
    if (!funcionario) {
      return NextResponse.json({ error: `${cargoEsperado === 'serrador' ? 'Serrador' : 'Acabador'} não encontrado` }, { status: 404 })
    }

    const { data: itensRow, error: itensErr } = await supabase
      .from('orcamento_itens')
      .select(SELECT_ITENS_PRODUCAO)
      .eq('marmoraria_id', marmoraria_id)
      .eq('orcamento_id', orcamento_id)
      .in('id', itensIds)
    if (itensErr) throw itensErr
    const itens = ((itensRow ?? []) as unknown as ItemProducao[]).filter(i => (i.tipo ?? 'material') === 'material')
    if (itens.length === 0) return NextResponse.json({ error: 'Nenhuma peça válida encontrada' }, { status: 404 })

    const { quantidadeSistema } = await import('@/lib/producao/quantidade-sistema')

    for (const item of itens) {
      const quantidade = quantidadeSistema(item, etapa)
      if (!(quantidade > 0)) continue
      await registrarPeca({
        marmoraria_id,
        orcamento_id,
        item,
        etapa,
        funcionario_id,
        data,
        quantidade,
        origem: 'automatico',
        status: statusDaEtapa(etapa),
      })
    }

    const avanco = await avancarSeEtapaCompleta(marmoraria_id, orcamento_id, etapa)

    return NextResponse.json({ ok: true, avanco })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/fila/registrar] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

export interface SugestaoCompra {
  chave: string
  tipo: 'material' | 'insumo'
  descricao: string
  detalhe: string
  quantidade: number
  unidade: string
  valor_sugerido: number
  vencimento_sugerido: string
  orcamento_id: string | null
}

const hojeISO = () => new Date().toISOString().slice(0, 10)

// GET — sugestões de compra:
//  1) material (chapa) dos pedidos aprovados que ainda não foram cortados,
//     agrupado por pedido + material, com o custo de material do orçamento;
//  2) insumos abaixo do estoque mínimo, sem pedido de compra pendente.
// Some da lista o que já foi programado (mesma `sugestao_chave`).
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [{ data: orcs, error: e1 }, { data: programadas, error: e2 }] = await Promise.all([
      supabase.from('orcamentos')
        .select('id, numero, titulo, data_prevista_instalacao, producao_status, clientes(nome)')
        .eq('marmoraria_id', marmoraria_id)
        .or('status.eq.aprovado,crm_status.eq.fechado')
        .in('producao_status', ['comercial', 'corte']),
      supabase.from('financeiro_lancamentos')
        .select('sugestao_chave, status')
        .eq('marmoraria_id', marmoraria_id)
        .not('sugestao_chave', 'is', null),
    ])
    if (e1) throw e1
    if (e2) throw e2

    const chavesMaterial = new Set((programadas || []).map(p => p.sugestao_chave as string))
    const chavesInsumoAbertas = new Set((programadas || []).filter(p => p.status === 'previsto').map(p => p.sugestao_chave as string))
    const sugestoes: SugestaoCompra[] = []
    const hoje = hojeISO()

    const orcIds = (orcs || []).map(o => o.id)
    if (orcIds.length) {
      const { data: itens, error: e3 } = await supabase.from('orcamento_itens')
        .select('orcamento_id, material_id, descricao, area, quantidade, custo_item, cortado_em, materiais(nome)')
        .in('orcamento_id', orcIds)
        .eq('tipo', 'material')
        .is('cortado_em', null)
      if (e3) throw e3

      const grupos = new Map<string, { orcamento_id: string; nome: string | null; descricoes: Set<string>; m2: number; custo: number; pecas: number }>()
      for (const it of itens || []) {
        const custo = Number(it.custo_item) || 0
        if (custo <= 0) continue
        const chave = `mat:${it.orcamento_id}:${it.material_id || 'sem'}`
        const nome = (it.materiais as unknown as { nome: string } | null)?.nome || null
        const area = Number(it.area) || 0
        const qtd = Number(it.quantidade) || 0
        const m2 = area > 0 ? area * (qtd || 1) : qtd
        const g = grupos.get(chave) || { orcamento_id: it.orcamento_id, nome, descricoes: new Set<string>(), m2: 0, custo: 0, pecas: 0 }
        g.m2 += m2; g.custo += custo; g.pecas += 1
        if (it.descricao) g.descricoes.add(String(it.descricao).trim())
        grupos.set(chave, g)
      }

      for (const [chave, g] of grupos) {
        if (chavesMaterial.has(chave)) continue
        const o = (orcs || []).find(x => x.id === g.orcamento_id)
        const cliente = (o?.clientes as unknown as { nome: string } | null)?.nome
        sugestoes.push({
          chave,
          tipo: 'material',
          // Sem vínculo com o estoque: mostra as descrições das peças pra identificar a pedra.
          descricao: g.nome || `Material do pedido: ${[...g.descricoes].slice(0, 3).join(', ')}${g.descricoes.size > 3 ? '…' : ''}`,
          detalhe: `Pedido #${o?.numero ?? '?'}${cliente ? ' — ' + cliente : ''} · ${g.pecas} peça(s) ainda não cortada(s)` +
            (o?.data_prevista_instalacao ? ` · instalação ${o.data_prevista_instalacao.split('-').reverse().join('/')}` : ''),
          quantidade: Math.round(g.m2 * 100) / 100,
          unidade: 'm²',
          valor_sugerido: Math.round(g.custo * 100) / 100,
          vencimento_sugerido: hoje,
          orcamento_id: g.orcamento_id,
        })
      }
    }

    const [{ data: insumos, error: e4 }, { data: pedPend, error: e5 }] = await Promise.all([
      supabase.from('insumos').select('id, nome, unidade, estoque_atual, estoque_minimo, preco_unitario').eq('marmoraria_id', marmoraria_id),
      supabase.from('insumo_pedidos').select('insumo_pedido_itens(insumo_id)').eq('marmoraria_id', marmoraria_id).eq('status', 'pendente'),
    ])
    if (e4) throw e4
    if (e5) throw e5
    const jaPedidos = new Set<string>()
    for (const p of pedPend || []) for (const it of (p.insumo_pedido_itens as { insumo_id: string }[]) || []) jaPedidos.add(it.insumo_id)

    for (const i of insumos || []) {
      const min = Number(i.estoque_minimo) || 0
      const atual = Number(i.estoque_atual) || 0
      if (min <= 0 || atual >= min) continue
      const chave = `ins:${i.id}`
      if (jaPedidos.has(i.id) || chavesInsumoAbertas.has(chave)) continue
      const falta = Math.round((min - atual) * 100) / 100
      sugestoes.push({
        chave,
        tipo: 'insumo',
        descricao: i.nome,
        detalhe: `Estoque ${atual} ${i.unidade || ''} · mínimo ${min}`,
        quantidade: falta,
        unidade: i.unidade || 'un',
        valor_sugerido: Math.round(falta * (Number(i.preco_unitario) || 0) * 100) / 100,
        vencimento_sugerido: hoje,
        orcamento_id: null,
      })
    }

    return NextResponse.json(sugestoes)
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, getAuthUserId, apiSupabase as supabase } from '@/lib/api-auth'

// Aprovação em lote do fechamento semanal: marca os apontamentos como
// aprovados, replica em funcionario_instalacoes (mesmo formato do
// lançamento manual de hoje — mantém relatórios/aba Instalações
// funcionando sem mudança), soma o valor no lançamento de pagamento da
// semana em funcionario_pagamentos (gera se não existir, soma se já existir)
// e — se a obra tem projeto associado — lança o custo em projeto_custos
// (o trigger trg_recalcular_custos_projeto atualiza projetos.custo_* sozinho).
//
// Decisão de 29/08: o valor sugerido pelo instalador não é mais 100%
// automático — o gestor pode ajustar antes de aprovar (peças menores
// valem menos). Por isso recebe `apontamentos: [{id, valor_calculado}]`
// em vez de só uma lista de ids; se o valor vier diferente do que está
// salvo, atualiza antes de somar no pagamento.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const usuario_id = await getAuthUserId()
    if (!usuario_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const itensRecebidos: { id: string; valor_calculado?: number }[] = Array.isArray(body.apontamentos) ? body.apontamentos : []
    const semana_referencia: string = String(body.semana_referencia ?? '')
    if (itensRecebidos.length === 0) return NextResponse.json({ error: 'Nenhum apontamento selecionado' }, { status: 400 })
    if (!semana_referencia) return NextResponse.json({ error: 'Semana de referência obrigatória' }, { status: 400 })

    const valorAjustadoPorId = new Map(
      itensRecebidos.filter(i => Number.isFinite(i.valor_calculado) && (i.valor_calculado as number) > 0)
        .map(i => [i.id, i.valor_calculado as number])
    )

    const { data: apontamentos, error: apontErr } = await supabase
      .from('producao_apontamentos')
      .select('id, funcionario_id, orcamento_id, orcamento_item_id, quantidade, valor_calculado, data, status, is_retroativo')
      .eq('marmoraria_id', marmoraria_id)
      .eq('etapa', 'instalacao')
      .in('id', itensRecebidos.map(i => i.id))
    if (apontErr) throw apontErr

    // Aplica o ajuste do gestor (se houver) antes de seguir — o valor final
    // usado em tudo daqui pra frente (funcionario_instalacoes, pagamento) é
    // este, não o que o instalador sugeriu originalmente.
    const pendentes = (apontamentos ?? [])
      .filter(a => a.status === 'pendente')
      .map(a => ({ ...a, valor_calculado: valorAjustadoPorId.get(a.id) ?? a.valor_calculado }))
    if (pendentes.length === 0) return NextResponse.json({ error: 'Nenhum dos apontamentos está pendente' }, { status: 400 })

    for (const a of pendentes) {
      const { error } = await supabase
        .from('producao_apontamentos')
        .update({ status: 'aprovado', aprovado_por: usuario_id, aprovado_em: new Date().toISOString(), valor_calculado: a.valor_calculado })
        .eq('id', a.id)
      if (error) throw error
    }

    // Centro de Custos: se a obra tem projeto associado, lança o custo de
    // instalação — o trigger da tabela recalcula projetos.custo_instalacao/
    // custo_total/margem_lucro sozinho. Obra avulsa (sem orçamento) não
    // tem projeto pra associar, então é pulada sem erro.
    const orcamentoIdsComProjeto = [...new Set(pendentes.filter(a => !a.is_retroativo && a.orcamento_id).map(a => a.orcamento_id as string))]
    if (orcamentoIdsComProjeto.length > 0) {
      const itemIds = [...new Set(pendentes.map(a => a.orcamento_item_id).filter((v): v is string => !!v))]
      const funcionarioIds = [...new Set(pendentes.map(a => a.funcionario_id))]

      const [{ data: projetos }, { data: itens }, { data: funcionarios }] = await Promise.all([
        supabase.from('projetos').select('id, orcamento_id').eq('marmoraria_id', marmoraria_id).in('orcamento_id', orcamentoIdsComProjeto),
        itemIds.length ? supabase.from('orcamento_itens').select('id, descricao').in('id', itemIds) : Promise.resolve({ data: [] as { id: string; descricao: string }[] }),
        supabase.from('funcionarios').select('id, nome').in('id', funcionarioIds),
      ])

      const projetoPorOrcamento = new Map((projetos ?? []).map(p => [p.orcamento_id, p.id]))
      const itemDescPorId = new Map((itens ?? []).map(i => [i.id, i.descricao]))
      const nomePorFuncionario = new Map((funcionarios ?? []).map(f => [f.id, f.nome]))
      const hoje = new Date().toISOString().split('T')[0]

      const custos = pendentes
        .filter(a => !a.is_retroativo && a.orcamento_id && projetoPorOrcamento.has(a.orcamento_id))
        .map(a => ({
          marmoraria_id,
          projeto_id: projetoPorOrcamento.get(a.orcamento_id as string) as string,
          tipo: 'instalacao',
          origem: 'automatico',
          funcionario_id: a.funcionario_id,
          valor: a.valor_calculado ?? 0,
          quantidade: a.quantidade,
          unidade: 'm',
          descricao: `Instalação — ${itemDescPorId.get(a.orcamento_item_id ?? '') ?? 'peça'} (${nomePorFuncionario.get(a.funcionario_id) ?? 'instalador'})`,
          data: hoje,
        }))

      if (custos.length > 0) {
        const { error: custoErr } = await supabase.from('projeto_custos').insert(custos)
        if (custoErr) throw custoErr
      }
      const semProjeto = orcamentoIdsComProjeto.filter(id => !projetoPorOrcamento.has(id))
      if (semProjeto.length > 0) {
        console.warn('[apontamentos-pendentes/aprovar] orçamentos sem projeto associado, custo não lançado no Centro de Custos:', semProjeto)
      }
    }

    // Replica em funcionario_instalacoes — formato idêntico ao lançamento
    // manual já existente, só que preenchido sozinho a partir da aprovação.
    const { error: instErr } = await supabase.from('funcionario_instalacoes').insert(
      pendentes.map(a => ({
        marmoraria_id,
        funcionario_id: a.funcionario_id,
        ordem_servico_id: a.orcamento_id,
        data: a.data,
        metros_lineares: a.quantidade,
        valor_metro_linear: a.quantidade > 0 ? (a.valor_calculado ?? 0) / a.quantidade : 0,
        valor_total: a.valor_calculado ?? 0,
        observacao: 'Gerado automaticamente na aprovação do portal do instalador',
      }))
    )
    if (instErr) throw instErr

    // Soma por instalador e gera/atualiza o pagamento da semana.
    const totalPorFuncionario = new Map<string, number>()
    for (const a of pendentes) {
      totalPorFuncionario.set(a.funcionario_id, (totalPorFuncionario.get(a.funcionario_id) ?? 0) + (a.valor_calculado ?? 0))
    }

    for (const [funcionario_id, valor] of totalPorFuncionario) {
      const { data: existente, error: existeErr } = await supabase
        .from('funcionario_pagamentos')
        .select('id, valor')
        .eq('marmoraria_id', marmoraria_id)
        .eq('funcionario_id', funcionario_id)
        .eq('tipo', 'pagamento')
        .eq('semana_referencia', semana_referencia)
        .eq('descricao', 'Fechamento semanal — portal do instalador')
        .maybeSingle()
      if (existeErr) throw existeErr

      if (existente) {
        const { error } = await supabase
          .from('funcionario_pagamentos')
          .update({ valor: existente.valor + valor })
          .eq('id', existente.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('funcionario_pagamentos').insert({
          marmoraria_id,
          funcionario_id,
          tipo: 'pagamento',
          valor,
          data: new Date().toISOString().split('T')[0],
          descricao: 'Fechamento semanal — portal do instalador',
          semana_referencia,
        })
        if (error) throw error
      }
    }

    return NextResponse.json({ ok: true, aprovados: pendentes.length })
  } catch (e: unknown) {
    // Erros do Supabase (PostgrestError) não são instâncias de Error.
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    console.error('[apontamentos-pendentes/aprovar] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Sincroniza as linhas de Material do centro de custo (projeto) com os itens
// do orçamento vinculado a ele: apaga as linhas automáticas antigas (tipo
// 'material', origem 'automatico') e recria uma linha por item de material
// com o custo calculado (custo_item), refletindo o estado atual do
// orçamento. Chamado ao criar um orçamento (centro de custo recém-aberto) e
// ao salvar edições em um orçamento que já tem centro de custo vinculado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: projeto, error: projErr } = await supabase
      .from('projetos')
      .select('id, orcamento_id, valor_venda')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()
    if (projErr) throw projErr
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    if (!projeto.orcamento_id) {
      return NextResponse.json({ error: 'Projeto não está vinculado a um orçamento' }, { status: 400 })
    }

    const { data: itensMaterial, error: itensErr } = await supabase
      .from('orcamento_itens')
      .select('descricao, quantidade, custo_item')
      .eq('orcamento_id', projeto.orcamento_id)
      .eq('tipo', 'material')
    if (itensErr) throw itensErr

    const { error: delErr } = await supabase
      .from('projeto_custos')
      .delete()
      .eq('projeto_id', id)
      .eq('tipo', 'material')
      .eq('origem', 'automatico')
    if (delErr) throw delErr

    const hoje = new Date().toISOString().split('T')[0]
    const linhas = (itensMaterial || [])
      .filter(i => (i.custo_item || 0) > 0)
      .map(i => ({
        marmoraria_id,
        projeto_id: id,
        tipo: 'material' as const,
        descricao: i.descricao || 'Material',
        valor: i.custo_item as number,
        quantidade: i.quantidade ?? null,
        data: hoje,
        origem: 'automatico' as const,
      }))

    if (linhas.length > 0) {
      const { error: insErr } = await supabase.from('projeto_custos').insert(linhas)
      if (insErr) throw insErr
    }

    // Recalcula os totais do projeto diretamente — não depende só do trigger
    // do banco, pra cobrir o caso da lista de material ficar vazia (delete
    // de 0 linhas não dispara o trigger de recálculo) e pra já refletir o
    // valor_venda mais recente do projeto.
    const { data: todosCustos, error: custosErr } = await supabase
      .from('projeto_custos')
      .select('tipo, valor')
      .eq('projeto_id', id)
    if (custosErr) throw custosErr

    const soma = (tipos: string[]) =>
      (todosCustos || []).filter(c => tipos.includes(c.tipo)).reduce((s, c) => s + (c.valor || 0), 0)

    const custo_material = soma(['material'])
    const custo_mao_obra = soma(['mao_obra'])
    const custo_instalacao = soma(['instalacao'])
    const custo_operacional = soma(['operacional', 'outros'])
    const custo_total = custo_material + custo_mao_obra + custo_instalacao + custo_operacional
    const valorVenda = projeto.valor_venda || 0
    const margem_lucro = valorVenda > 0 ? ((valorVenda - custo_total) / valorVenda) * 100 : 0

    const { error: updErr } = await supabase.from('projetos').update({
      custo_material, custo_mao_obra, custo_instalacao, custo_operacional, custo_total, margem_lucro,
    }).eq('id', id)
    if (updErr) throw updErr

    return NextResponse.json({ ok: true, linhas: linhas.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

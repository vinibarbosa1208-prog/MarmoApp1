import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: projeto, error } = await supabase
      .from('projetos')
      .select('*, clientes(nome), projeto_custos(*), projeto_etapas(*)')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (error) throw error
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const margem_percentual = projeto.valor_venda > 0
      ? Math.round((projeto.margem_lucro / projeto.valor_venda) * 10000) / 100
      : 0

    const etapas = (projeto.projeto_etapas || []).sort(
      (a: { entrada_em: string }, b: { entrada_em: string }) =>
        new Date(a.entrada_em).getTime() - new Date(b.entrada_em).getTime()
    )

    let orcamento_itens: Array<{ tipo: string; custo_item: number | null; total_item: number | null }> = []
    if (projeto.orcamento_id) {
      const { data: items } = await supabase
        .from('orcamento_itens')
        .select('tipo, custo_item, total_item')
        .eq('orcamento_id', projeto.orcamento_id)
      orcamento_itens = items || []
    }

    return NextResponse.json({
      ...projeto,
      cliente_nome: projeto.clientes?.nome ?? null,
      clientes: undefined,
      custos: projeto.projeto_custos || [],
      projeto_custos: undefined,
      etapas,
      projeto_etapas: undefined,
      margem_percentual,
      orcamento_itens,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    delete body.marmoraria_id

    const { data, error } = await supabase
      .from('projetos')
      .update(body)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

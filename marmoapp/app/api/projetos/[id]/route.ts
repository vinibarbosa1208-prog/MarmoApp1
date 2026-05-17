import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcularMargem } from '@/lib/projetos/calcular-margem'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data } = await supabase.from('usuarios').select('marmoraria_id').eq('id', user.id).maybeSingle()
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

// GET /api/projetos/[id] — projeto completo com custos e breakdown por tipo
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: projeto, error } = await supabase
      .from('projects')
      .select(`
        *,
        clientes(nome),
        project_costs(
          id, descricao, valor, data, created_at, updated_at,
          tipo:project_cost_types(id, nome, cor)
        )
      `)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (error) throw error
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const custos = projeto.project_costs || []
    const { custoTotal, margemValor, margemPercentual } = calcularMargem(projeto.valor_venda, custos)

    // Breakdown por tipo
    const byTipo: Record<string, { nome: string; cor: string; total: number }> = {}
    for (const c of custos) {
      const tipoId = c.tipo?.id ?? 'sem_tipo'
      const tipoNome = c.tipo?.nome ?? 'Sem categoria'
      const tipoCor = c.tipo?.cor ?? '#888888'
      if (!byTipo[tipoId]) byTipo[tipoId] = { nome: tipoNome, cor: tipoCor, total: 0 }
      byTipo[tipoId].total += Number(c.valor)
    }

    return NextResponse.json({
      ...projeto,
      cliente_nome: projeto.clientes?.nome ?? null,
      clientes: undefined,
      custos,
      custo_total: custoTotal,
      margem_valor: margemValor,
      margem_percentual: margemPercentual,
      breakdown_por_tipo: Object.values(byTipo),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// PUT /api/projetos/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    delete body.marmoraria_id

    const { data, error } = await supabase
      .from('projects')
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

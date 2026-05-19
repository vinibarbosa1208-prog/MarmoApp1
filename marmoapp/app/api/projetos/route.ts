import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { calcularMargem } from '@/lib/projetos/calcular-margem'
import type { CreateProjectInput } from '@/lib/projetos/types'

// GET /api/projetos?status=em_andamento
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const status = req.nextUrl.searchParams.get('status')

    let query = supabase
      .from('projects')
      .select('*, clientes(nome), project_costs(valor)')
      .eq('marmoraria_id', marmoraria_id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    const projetos = (data || []).map(p => {
      const custos: { valor: number }[] = p.project_costs || []
      const { custoTotal, margemValor, margemPercentual } = calcularMargem(p.valor_venda, custos)
      return {
        ...p,
        cliente_nome: p.clientes?.nome ?? null,
        custo_total: custoTotal,
        margem_valor: margemValor,
        margem_percentual: margemPercentual,
        project_costs: undefined,
        clientes: undefined,
      }
    })

    return NextResponse.json(projetos)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// POST /api/projetos
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body: CreateProjectInput = await req.json()
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (body.valor_venda === undefined || body.valor_venda < 0) {
      return NextResponse.json({ error: 'Valor de venda inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...body, marmoraria_id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

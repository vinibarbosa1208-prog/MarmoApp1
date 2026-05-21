import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semana = req.nextUrl.searchParams.get('semana')
    const funcionario_id = req.nextUrl.searchParams.get('funcionario_id')

    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('marmoraria_id', marmoraria_id)

    const funcIds = (funcs ?? []).map(f => f.id)
    if (!funcIds.length) return NextResponse.json([])

    let query = supabase
      .from('funcionario_instalacoes')
      .select('*, funcionarios(id, nome)')
      .in('funcionario_id', funcIds)
      .order('data', { ascending: false })

    if (semana) {
      const fimDate = new Date(semana + 'T00:00:00')
      fimDate.setDate(fimDate.getDate() + 7)
      query = query.gte('data', semana).lt('data', fimDate.toISOString().split('T')[0])
    }

    if (funcionario_id) {
      query = query.eq('funcionario_id', funcionario_id)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()

    if (!body.funcionario_id) return NextResponse.json({ error: 'Funcionário obrigatório' }, { status: 400 })

    const { data: func } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', body.funcionario_id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (!func) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

    const metros = Number(body.metros_lineares) || 0
    const valorMetro = Number(body.valor_metro_linear) || 0

    const { data, error } = await supabase
      .from('funcionario_instalacoes')
      .insert({
        funcionario_id: body.funcionario_id,
        ordem_servico_id: body.ordem_servico_id || null,
        data: body.data || new Date().toISOString().split('T')[0],
        metros_lineares: metros,
        valor_metro_linear: valorMetro,
        valor_total: metros * valorMetro,
      })
      .select('*, funcionarios(id, nome)')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semana = req.nextUrl.searchParams.get('semana') // YYYY-MM-DD (segunda-feira)
    if (!semana) return NextResponse.json({ error: 'Parâmetro semana obrigatório' }, { status: 400 })

    const fimDate = new Date(semana + 'T00:00:00')
    fimDate.setDate(fimDate.getDate() + 7)
    const fim = fimDate.toISOString().split('T')[0]

    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('marmoraria_id', marmoraria_id)

    const funcIds = (funcs ?? []).map(f => f.id)
    if (!funcIds.length) return NextResponse.json([])

    const { data, error } = await supabase
      .from('funcionario_presencas')
      .select('*')
      .in('funcionario_id', funcIds)
      .gte('data', semana)
      .lt('data', fim)

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

    const { data: func } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', body.funcionario_id)
      .eq('marmoraria_id', marmoraria_id)
      .single()

    if (!func) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('funcionario_presencas')
      .upsert(
        {
          funcionario_id: body.funcionario_id,
          data: body.data,
          presente: body.presente,
          valor_diaria: Number(body.valor_diaria) || 0,
        },
        { onConflict: 'funcionario_id,data' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

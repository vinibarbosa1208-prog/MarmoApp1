import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('agenda_event_types')
      .select('*')
      .eq('marmoraria_id', marmoraria_id)
      .order('nome')

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as { nome: string; cor: string }
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('agenda_event_types')
      .insert({ nome: body.nome.trim(), cor: body.cor || '#C9A84C', marmoraria_id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CreateAgendaEventInput } from '@/lib/agenda/types'

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

// GET /api/agenda/events?semana=2026-05-12  (segunda-feira da semana)
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semana = req.nextUrl.searchParams.get('semana')
    let query = supabase
      .from('agenda_events')
      .select('*, tipo:agenda_event_types(id,nome,cor,icone)')
      .eq('marmoraria_id', marmoraria_id)
      .order('data_inicio')

    if (semana) {
      const inicio = new Date(semana)
      const fim = new Date(semana)
      fim.setDate(fim.getDate() + 7)
      query = query
        .gte('data_inicio', inicio.toISOString())
        .lt('data_inicio', fim.toISOString())
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// POST /api/agenda/events
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body: CreateAgendaEventInput = await req.json()
    if (!body.titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    if (!body.data_inicio) return NextResponse.json({ error: 'Data de início obrigatória' }, { status: 400 })

    const { data, error } = await supabase
      .from('agenda_events')
      .insert({ ...body, marmoraria_id, status: 'agendado' })
      .select('*, tipo:agenda_event_types(id,nome,cor,icone)')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

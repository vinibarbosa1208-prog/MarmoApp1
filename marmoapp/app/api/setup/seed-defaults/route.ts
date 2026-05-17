import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_EVENT_TYPES = [
  { nome: 'Visita técnica',      cor: '#185FA5' },
  { nome: 'Entrega/Instalação',  cor: '#1D9E75' },
  { nome: 'Tarefa interna',      cor: '#B8922E' },
]

const DEFAULT_COST_TYPES = [
  { nome: 'Material',   cor: '#185FA5' },
  { nome: 'Mão de obra', cor: '#B8922E' },
  { nome: 'Terceiros',  cor: '#5C5448' },
]

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('marmoraria_id')
      .eq('id', user.id)
      .maybeSingle()

    const marmoraria_id = (usuario as { marmoraria_id: string } | null)?.marmoraria_id
    if (!marmoraria_id) return NextResponse.json({ error: 'Marmoraria não encontrada' }, { status: 404 })

    // Idempotente: inserir apenas tipos que não existem ainda
    const { data: existingEventTypes } = await supabase
      .from('agenda_event_types')
      .select('nome')
      .eq('marmoraria_id', marmoraria_id)

    const existingEventNames = new Set((existingEventTypes || []).map(t => t.nome))
    const newEventTypes = DEFAULT_EVENT_TYPES
      .filter(t => !existingEventNames.has(t.nome))
      .map(t => ({ ...t, marmoraria_id }))

    if (newEventTypes.length > 0) {
      await supabase.from('agenda_event_types').insert(newEventTypes)
    }

    const { data: existingCostTypes } = await supabase
      .from('project_cost_types')
      .select('nome')
      .eq('marmoraria_id', marmoraria_id)

    const existingCostNames = new Set((existingCostTypes || []).map(t => t.nome))
    const newCostTypes = DEFAULT_COST_TYPES
      .filter(t => !existingCostNames.has(t.nome))
      .map(t => ({ ...t, marmoraria_id }))

    if (newCostTypes.length > 0) {
      await supabase.from('project_cost_types').insert(newCostTypes)
    }

    return NextResponse.json({
      event_types_inserted: newEventTypes.length,
      cost_types_inserted: newCostTypes.length,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

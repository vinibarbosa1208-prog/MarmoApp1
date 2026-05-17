import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CreateProjectCostInput } from '@/lib/projetos/types'

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

async function assertProjectOwnership(projectId: string, marmoraria_id: string): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()
  return !!data
}

// GET /api/projetos/[id]/custos
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!(await assertProjectOwnership(id, marmoraria_id))) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('project_costs')
      .select('*, tipo:project_cost_types(id,nome,cor)')
      .eq('project_id', id)
      .order('data', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// POST /api/projetos/[id]/custos
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!(await assertProjectOwnership(id, marmoraria_id))) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const body: CreateProjectCostInput = await req.json()
    if (!body.descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
    if (body.valor === undefined || body.valor < 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_costs')
      .insert({
        project_id: id,
        tipo_id: body.tipo_id ?? null,
        descricao: body.descricao,
        valor: body.valor,
        data: body.data ?? new Date().toISOString().split('T')[0],
      })
      .select('*, tipo:project_cost_types(id,nome,cor)')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

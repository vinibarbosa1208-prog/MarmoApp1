import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

const ETAPAS = ['comercial', 'producao', 'pronto', 'agendado', 'instalacao', 'concluido'] as const
type Etapa = typeof ETAPAS[number]

async function assertOwnership(projetoId: string, marmoraria_id: string) {
  const { data } = await supabase
    .from('projetos')
    .select('id')
    .eq('id', projetoId)
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()
  return !!data
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!(await assertOwnership(id, marmoraria_id))) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('projeto_etapas')
      .select('*')
      .eq('projeto_id', id)
      .order('entrada_em', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!(await assertOwnership(id, marmoraria_id))) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const novaEtapa: Etapa = body.etapa

    if (!ETAPAS.includes(novaEtapa)) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Close current active etapa
    const { data: ativas } = await supabase
      .from('projeto_etapas')
      .select('*')
      .eq('projeto_id', id)
      .is('saida_em', null)

    if (ativas && ativas.length > 0) {
      const atual = ativas[0]
      const dias = Math.round(
        (new Date(now).getTime() - new Date(atual.entrada_em).getTime()) / (1000 * 60 * 60 * 24)
      )
      await supabase
        .from('projeto_etapas')
        .update({ saida_em: now, dias_na_etapa: dias })
        .eq('id', atual.id)
    }

    const { data, error } = await supabase
      .from('projeto_etapas')
      .insert({ projeto_id: id, etapa: novaEtapa, entrada_em: now })
      .select()
      .single()

    if (error) throw error

    if (novaEtapa === 'concluido') {
      await supabase
        .from('projetos')
        .update({ status: 'concluido', data_conclusao: now.split('T')[0] })
        .eq('id', id)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

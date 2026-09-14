import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const hoje = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('insumo_solicitacoes')
      .update({ status: 'comprado', data_comprado: hoje })
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('*, insumos(nome, unidade, categoria)')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

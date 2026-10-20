import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Erro interno'
}

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { data, error } = await supabase
      .from('financeiro_recorrencias').select('*')
      .eq('marmoraria_id', marmoraria_id)
      .order('ativo', { ascending: false }).order('dia_vencimento')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const b = await req.json()
    if (!b.descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
    const valor = Number(b.valor)
    if (!(valor > 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    const dia = Number(b.dia_vencimento)
    if (!(dia >= 1 && dia <= 31)) return NextResponse.json({ error: 'Dia de vencimento deve ser entre 1 e 31' }, { status: 400 })

    const { data, error } = await supabase.from('financeiro_recorrencias').insert({
      marmoraria_id,
      descricao: b.descricao.trim(),
      contraparte: b.contraparte?.trim() || null,
      categoria: b.categoria || 'despesa_fixa',
      valor,
      dia_vencimento: dia,
      inicio: b.inicio || new Date().toISOString().slice(0, 10),
      fim: b.fim || null,
    }).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

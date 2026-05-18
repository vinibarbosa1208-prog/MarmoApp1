import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { FieldType } from '@/lib/configuracoes/types'

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

const VALID_TIPOS: FieldType[] = ['texto', 'numero', 'data', 'booleano']

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('client_custom_fields')
      .select('*')
      .eq('marmoraria_id', marmoraria_id)
      .order('ordem')
      .order('created_at')

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

    const body = await req.json() as { nome: string; tipo: FieldType; obrigatorio?: boolean; ordem?: number }
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!VALID_TIPOS.includes(body.tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('client_custom_fields')
      .insert({
        nome: body.nome.trim(),
        tipo: body.tipo,
        obrigatorio: body.obrigatorio ?? false,
        ordem: body.ordem ?? 0,
        marmoraria_id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

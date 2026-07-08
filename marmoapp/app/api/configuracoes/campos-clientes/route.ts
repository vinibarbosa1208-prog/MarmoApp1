import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { FieldType } from '@/lib/configuracoes/types'

const VALID_TIPOS: FieldType[] = ['texto', 'numero', 'data', 'booleano']

async function getMarmorariaId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()

  if (usuario?.marmoraria_id) return usuario.marmoraria_id

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )
  const { data: marmoraria } = await service
    .from('marmorarias')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  return marmoraria?.id ?? null
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const marmoraria_id = await getMarmorariaId()
    if (!marmoraria_id) return NextResponse.json({ error: 'Marmoraria não encontrada' }, { status: 403 })

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )

    const { data, error } = await service
      .from('client_custom_fields')
      .select('*')
      .eq('marmoraria_id', marmoraria_id)
      .order('ordem')
      .order('created_at')

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const marmoraria_id = await getMarmorariaId()
    if (!marmoraria_id) return NextResponse.json({ error: 'Marmoraria não encontrada' }, { status: 403 })

    const body = await req.json() as { nome: string; tipo: FieldType; obrigatorio?: boolean; ordem?: number }
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!VALID_TIPOS.includes(body.tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )

    const { data, error } = await service
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
  } catch (err) {
    console.error('Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('marketing_metricas')
    .select('*')
    .order('semana_ref', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const body = await request.json()
  const { alcance_total, novos_seguidores, engajamento_medio, cliques_bio, leads_gerados } = body

  if (
    alcance_total === undefined ||
    novos_seguidores === undefined ||
    engajamento_medio === undefined ||
    cliques_bio === undefined ||
    leads_gerados === undefined
  ) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('marketing_metricas')
    .insert({
      semana_ref: hoje,
      alcance_total: Number(alcance_total),
      novos_seguidores: Number(novos_seguidores),
      engajamento_medio: Number(engajamento_medio),
      cliques_bio: Number(cliques_bio),
      leads_gerados: Number(leads_gerados),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

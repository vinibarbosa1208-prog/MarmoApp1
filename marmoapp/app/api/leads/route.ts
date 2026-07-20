import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()

  const { nome_marmoraria, nome_contato, whatsapp, email, tamanho_equipe } = body

  if (!nome_contato || !email) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 })
  }

  // Captura UTM params do referer
  const referer = request.headers.get('referer') ?? ''
  let utmSource: string | null = null
  let utmMedium: string | null = null
  let utmCampaign: string | null = null
  try {
    const url = new URL(referer)
    utmSource = url.searchParams.get('utm_source')
    utmMedium = url.searchParams.get('utm_medium')
    utmCampaign = url.searchParams.get('utm_campaign')
  } catch {}

  const utm_source = body.utm_source ?? utmSource
  const utm_medium = body.utm_medium ?? utmMedium
  const utm_campaign = body.utm_campaign ?? utmCampaign

  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .insert({
      nome_marmoraria,
      nome_contato,
      whatsapp,
      email,
      tamanho_equipe,
      utm_source,
      utm_medium,
      utm_campaign,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao salvar lead:', error)
    return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 })
  }

  // Redireciona para /cadastro com dados pré-preenchidos
  const params = new URLSearchParams()
  if (nome_marmoraria) params.set('marmoraria', nome_marmoraria)
  if (email) params.set('email', email)

  return NextResponse.json({
    success: true,
    lead_id: lead.id,
    redirect: `/cadastro?${params.toString()}`,
  })
}

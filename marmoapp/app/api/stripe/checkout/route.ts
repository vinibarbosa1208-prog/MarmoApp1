import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { stripe, PLANO_PRICE_MAP } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId()
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { plano } = await req.json()
    const priceId = PLANO_PRICE_MAP[plano]
    if (!priceId) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    const { data: marmoraria } = await supabase
      .from('marmorarias')
      .select('id, email, trial_expira')
      .eq('id', marmoraria_id)
      .single()

    if (!marmoraria) return NextResponse.json({ error: 'Marmoraria não encontrada' }, { status: 404 })

    const { data: assinatura } = await supabase
      .from('assinaturas')
      .select('stripe_customer')
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()

    let customerId = assinatura?.stripe_customer as string | undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: marmoraria.email ?? undefined,
        metadata: { marmoraria_id },
      })
      customerId = customer.id
    }

    // Trial só oferecido se trial_expira ainda não foi definido (nunca usou)
    const trialUsado = !!marmoraria.trial_expira

    // Deriva a URL base do próprio request (funciona em localhost e em produção)
    const origin = req.headers.get('origin')
      || req.headers.get('referer')?.replace(/\/$/, '').split('/').slice(0, 3).join('/')
      || process.env.NEXT_PUBLIC_APP_URL
      || 'https://app.marmoapp.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/cadastro`,
      metadata: { marmoraria_id, plano },
      subscription_data: {
        metadata: { marmoraria_id, plano },
        ...(!trialUsado ? { trial_period_days: 7 } : {}),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe/checkout]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

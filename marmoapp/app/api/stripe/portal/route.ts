import { NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { stripe } from '@/lib/stripe'

export async function POST() {
  try {
    const marmoraria_id = await getMarmorariaId()
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: assinatura } = await supabase
      .from('assinaturas')
      .select('stripe_customer')
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()

    if (!assinatura?.stripe_customer) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: assinatura.stripe_customer as string,
      return_url: `${appUrl}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe/portal]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

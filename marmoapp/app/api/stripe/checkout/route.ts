import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { apiSupabase } from '@/lib/api-auth'
import { stripe, PLANO_PRICE_MAP } from '@/lib/stripe'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getAuthUser() {
  const cookieStore = await cookies()
  const authClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
  const { data: { user } } = await authClient.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plano, nome, cnpj, telefone, cidade, email: emailForm } = body

    const priceId = PLANO_PRICE_MAP[plano]
    if (!priceId) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    // Autentica usuário via cookies
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Busca marmoraria existente pelo owner_id (service role, sem RLS)
    let { data: marmoraria } = await apiSupabase
      .from('marmorarias')
      .select('id, email, trial_expira')
      .eq('owner_id', user.id)
      .maybeSingle()

    // Se não existe, cria agora com service role (bypassa RLS)
    if (!marmoraria && nome) {
      const { data: nova, error: insErr } = await apiSupabase
        .from('marmorarias')
        .insert({
          owner_id:        user.id,
          nome:            nome.trim(),
          cnpj:            cnpj || null,
          telefone:        telefone || null,
          cidade:          cidade || null,
          email:           emailForm || user.email,
          plano,
          trial_expira:    null,   // Stripe controla o trial
          setup_concluido: true,
        })
        .select('id, email, trial_expira')
        .single()

      if (insErr) {
        console.error('[checkout] marmoraria insert:', insErr.message)
        return NextResponse.json({ error: 'Erro ao criar marmoraria' }, { status: 500 })
      }
      marmoraria = nova
    }

    if (!marmoraria) return NextResponse.json({ error: 'Marmoraria não encontrada' }, { status: 404 })

    const marmoraria_id = marmoraria.id

    const { data: assinatura } = await apiSupabase
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

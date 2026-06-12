import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { stripe, PRICE_PLANO_MAP } from '@/lib/stripe'
import type Stripe from 'stripe'

function toDateStr(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split('T')[0]
}

function customerId(obj: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!obj) return null
  return typeof obj === 'string' ? obj : obj.id
}

// App Router: body raw (text) para validação de assinatura Stripe
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.error('[stripe/webhook] signature failed:', msg)
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const custId         = customerId(session.customer)
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription : session.subscription?.id
        const marmoraria_id  = session.metadata?.marmoraria_id
        const plano          = session.metadata?.plano

        if (!custId || !subscriptionId || !marmoraria_id || !plano) break

        // Expandir latest_invoice para obter período atual (current_period removido na v2026)
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['latest_invoice'],
        })
        const invoice    = sub.latest_invoice as Stripe.Invoice | null
        const dataInicio = invoice?.period_start ? toDateStr(invoice.period_start) : new Date().toISOString().split('T')[0]
        const dataFim    = invoice?.period_end   ? toDateStr(invoice.period_end)   : null
        const priceId    = sub.items.data[0]?.price.id

        await supabase.from('assinaturas').upsert(
          {
            marmoraria_id,
            stripe_customer:  custId,
            stripe_sub_id:    subscriptionId,
            stripe_price_id:  priceId,
            plano,
            status:           'active',
            data_inicio:      dataInicio,
            data_fim:         dataFim,
            cancelar_no_fim:  sub.cancel_at_period_end,
          },
          { onConflict: 'marmoraria_id' }
        )

        await supabase.from('marmorarias').update({ plano, ativo: true }).eq('id', marmoraria_id)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const custId  = customerId(invoice.customer)
        if (!custId) break

        await supabase
          .from('assinaturas')
          .update({
            status:     'active',
            data_inicio: toDateStr(invoice.period_start),
            data_fim:    toDateStr(invoice.period_end),
          })
          .eq('stripe_customer', custId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const custId  = customerId(invoice.customer)
        if (!custId) break

        await supabase
          .from('assinaturas')
          .update({ status: 'past_due' })
          .eq('stripe_customer', custId)
        break
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object as Stripe.Subscription
        const custId  = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        const priceId = sub.items.data[0]?.price.id
        const plano   = PRICE_PLANO_MAP[priceId] ?? 'basic'

        if (!custId) break

        // Expandir latest_invoice para obter data_fim atualizada
        const subExpanded = await stripe.subscriptions.retrieve(sub.id, {
          expand: ['latest_invoice'],
        })
        const invoice = subExpanded.latest_invoice as Stripe.Invoice | null
        const dataFim = invoice?.period_end ? toDateStr(invoice.period_end) : undefined

        await supabase
          .from('assinaturas')
          .update({
            plano,
            stripe_price_id: priceId,
            status:          sub.status,
            cancelar_no_fim: sub.cancel_at_period_end,
            ...(dataFim ? { data_fim: dataFim } : {}),
          })
          .eq('stripe_customer', custId)

        const { data: row } = await supabase
          .from('assinaturas')
          .select('marmoraria_id')
          .eq('stripe_customer', custId)
          .maybeSingle()

        if (row?.marmoraria_id) {
          await supabase.from('marmorarias').update({ plano }).eq('id', row.marmoraria_id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        if (!custId) break

        await supabase
          .from('assinaturas')
          .update({ status: 'canceled' })
          .eq('stripe_customer', custId)

        const { data: row } = await supabase
          .from('assinaturas')
          .select('marmoraria_id')
          .eq('stripe_customer', custId)
          .maybeSingle()

        if (row?.marmoraria_id) {
          await supabase.from('marmorarias').update({ plano: 'trial' }).eq('id', row.marmoraria_id)
        }
        break
      }
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err)
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

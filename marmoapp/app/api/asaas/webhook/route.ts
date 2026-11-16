import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { apiSupabase } from '@/lib/api-auth'

// Webhook do Asaas: libera o acesso quando a mensalidade é paga e volta para a tela de
// pagamento quando a assinatura é cancelada. Autenticado pelo token configurado no Asaas
// (cabeçalho asaas-access-token) = ASAAS_WEBHOOK_TOKEN.
// Responde 200 mesmo para eventos ignorados: o Asaas pausa a fila depois de erros seguidos.

function tokenOk(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

type Evento = {
  event?: string
  payment?: { id: string; subscription?: string | null; externalReference?: string | null }
  subscription?: { id: string; externalReference?: string | null }
}

async function acharMarmoraria(assinatura?: string | null, referencia?: string | null) {
  if (assinatura) {
    const { data } = await apiSupabase.from('marmorarias').select('id').eq('asaas_subscription_id', assinatura).maybeSingle()
    if (data) return data.id as string
  }
  if (referencia && /^[0-9a-f-]{36}$/i.test(referencia)) {
    const { data } = await apiSupabase.from('marmorarias').select('id').eq('id', referencia).maybeSingle()
    if (data) return data.id as string
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const ev = (await req.json().catch(() => ({}))) as Evento
  try {
    switch (ev.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        const id = await acharMarmoraria(ev.payment?.subscription, ev.payment?.externalReference)
        if (!id) break
        // trial_expira preenchido = pagamento confirmado (nome antigo do campo)
        await apiSupabase.from('marmorarias').update({ plano: 'pro', ativo: true, trial_expira: new Date().toISOString() }).eq('id', id)
        break
      }
      case 'SUBSCRIPTION_DELETED':
      case 'SUBSCRIPTION_INACTIVATED': {
        const id = await acharMarmoraria(ev.subscription?.id, ev.subscription?.externalReference)
        if (!id) break
        await apiSupabase.from('marmorarias').update({ plano: 'trial', trial_expira: null }).eq('id', id)
        break
      }
    }
  } catch (e) {
    console.error('[asaas/webhook]', ev.event, e)
  }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { confirmarPagamento } from '@/lib/minha-pia/cobranca'
import { errMsg } from '@/lib/minha-pia/servidor'

// Webhook do Asaas. Configurar no painel do Asaas:
//   URL:   https://app.marmoapp.com/api/minha-pia/webhook-asaas
//   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN
//   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_DELETED, PAYMENT_OVERDUE
function tokenOk(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido), b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    const evento = await req.json()
    const pay = evento?.payment as { id?: string; value?: number; paymentDate?: string; clientPaymentDate?: string } | undefined
    if (!pay?.id) return NextResponse.json({ ok: true })

    const { data: pag } = await supabase.from('programado_pagamentos').select('id, status').eq('asaas_payment_id', pay.id).maybeSingle()
    // Cobrança que não é da Pia Programada (ex.: assinatura do MarmoApp): ignora.
    if (!pag) return NextResponse.json({ ok: true })

    switch (evento.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await confirmarPagamento(pag.id, {
          valorRecebido: Number(pay.value) || undefined,
          pagoEm: pay.clientPaymentDate || pay.paymentDate ? new Date((pay.clientPaymentDate || pay.paymentDate) + 'T12:00:00-03:00').toISOString() : undefined,
          forma: 'pix',
        })
        break
      case 'PAYMENT_DELETED':
        if (pag.status === 'pendente') await supabase.from('programado_pagamentos').update({ status: 'cancelado' }).eq('id', pag.id)
        break
      case 'PAYMENT_OVERDUE':
        if (pag.status === 'pendente') await supabase.from('programado_pagamentos').update({ status: 'expirado' }).eq('id', pag.id)
        break
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[minha-pia/webhook-asaas]', errMsg(e))
    // 500 faz o Asaas reenviar depois — a baixa é idempotente.
    return NextResponse.json({ error: 'erro' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { runAgent } from '@/lib/antonio/agent'
import { sendWhatsAppText } from '@/lib/antonio/whatsapp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] EVOLUTION_WEBHOOK_SECRET não configurado — bloqueando')
      return false
    }
    console.warn('[webhook] EVOLUTION_WEBHOOK_SECRET não configurado — modo dev')
    return true
  }
  if (!signature) return false
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(signature.replace('sha256=', ''), 'hex')
    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Agente Antônio webhook ativo' })
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-evolution-signature')

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[webhook] Assinatura inválida rejeitada')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const msg = body.data?.message
    const from: string = body.data?.key?.remoteJid
    const instance: string = body.instance
    const fromMe: boolean = body.data?.key?.fromMe

    if (!msg || !from || fromMe || !instance?.trim()) return NextResponse.json({ ok: true })

    const textContent: string =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      ''

    if (!textContent.trim()) return NextResponse.json({ ok: true })

    const { data: marmoraria } = await supabase
      .from('marmorarias')
      .select('id, nome, plano')
      .eq('evolution_instance_name', instance)
      .maybeSingle()

    if (!marmoraria || marmoraria.plano !== 'enterprise') return NextResponse.json({ ok: true })

    const [{ data: materiais }, { data: servicos }, { data: clientes }] = await Promise.all([
      supabase.from('materiais').select('*').eq('marmoraria_id', marmoraria.id),
      supabase.from('servicos').select('*').eq('marmoraria_id', marmoraria.id),
      supabase.from('clientes').select('*').eq('marmoraria_id', marmoraria.id),
    ])

    const result = await runAgent(
      [{ role: 'user', content: textContent }],
      {
        marmoraria: { id: marmoraria.id, nome: marmoraria.nome },
        materiais: materiais || [],
        servicos: servicos || [],
        clientes: clientes || [],
      }
    )

    await sendWhatsAppText({ instance, to: from, text: result.displayText || 'Desculpe, não entendi.' })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[antonio/webhook] error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

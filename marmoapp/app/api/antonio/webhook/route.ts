import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/antonio/agent'
import { sendWhatsAppText, jidToPhone } from '@/lib/antonio/whatsapp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  return NextResponse.json({ status: 'Agente Antônio webhook ativo' })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ ok: true })
    }

    const msg = body.data?.message
    const from: string = body.data?.key?.remoteJid
    const instance: string = body.instance
    const fromMe: boolean = body.data?.key?.fromMe

    if (!msg || !from || fromMe) return NextResponse.json({ ok: true })

    const textContent: string =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      ''

    if (!textContent.trim()) return NextResponse.json({ ok: true })

    const phone = jidToPhone(from)

    const { data: marmoraria } = await supabase
      .from('marmorarias')
      .select('*')
      .ilike('nome', `%${instance}%`)
      .maybeSingle()

    if (!marmoraria || marmoraria.plano !== 'enterprise') {
      return NextResponse.json({ ok: true })
    }

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

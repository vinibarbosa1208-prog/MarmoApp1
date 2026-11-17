import { NextRequest, NextResponse } from 'next/server'
import { configInstagram } from '@/lib/instagram'
import { sincronizarMetricasIG } from '@/lib/instagram-metricas'

export const runtime = 'nodejs'
export const maxDuration = 60

// De hora em hora pelo pg_cron do Supabase (x-cron-key) ou pelo cron da Vercel (CRON_SECRET).
export async function GET(request: NextRequest) {
  const chave = request.headers.get('x-cron-key')
  const ok =
    request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}` ||
    (!!process.env.IG_CRON_KEY && chave === process.env.IG_CRON_KEY)
  if (!ok) return new NextResponse('Unauthorized', { status: 401 })
  if (!configInstagram().pronto) return NextResponse.json({ skipped: 'Instagram não configurado' })
  try {
    return NextResponse.json(await sincronizarMetricasIG('cron'))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

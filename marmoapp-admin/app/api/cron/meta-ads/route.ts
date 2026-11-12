import { NextRequest, NextResponse } from 'next/server'
import { configMeta, sincronizarMeta } from '@/lib/meta'

export const runtime = 'nodejs'
export const maxDuration = 60

// Todo dia de manhã: últimos 7 dias (o Meta ainda corrige os números dos dias anteriores).
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  if (!configMeta().pronto) return NextResponse.json({ skipped: 'Meta Ads não configurado' })
  try {
    return NextResponse.json(await sincronizarMeta('cron', 7))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

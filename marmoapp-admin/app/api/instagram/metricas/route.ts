import { NextResponse } from 'next/server'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { sincronizarMetricasIG } from '@/lib/instagram-metricas'

export const runtime = 'nodejs'
export const maxDuration = 60

// Botão "Atualizar agora" dos números do Instagram.
export async function POST() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await sincronizarMetricasIG('manual'))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

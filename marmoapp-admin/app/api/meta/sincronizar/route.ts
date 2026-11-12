import { NextResponse } from 'next/server'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { sincronizarMeta } from '@/lib/meta'

export const runtime = 'nodejs'
export const maxDuration = 60

// Botão "Atualizar agora" da tela de Marketing.
export async function POST() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await sincronizarMeta('manual', 30))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

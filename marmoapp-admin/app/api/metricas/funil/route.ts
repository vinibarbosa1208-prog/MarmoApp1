import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import type { Marmoraria } from '@/lib/types'

export async function GET() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: marmorarias } = await supabaseAdmin
    .from('marmorarias')
    .select('id, plano, setup_concluido, trial_expira')

  const ms = (marmorarias ?? []) as Marmoraria[]
  const now = new Date()

  const total = ms.length
  const setupConcluido = ms.filter((m) => m.setup_concluido).length
  const trials = ms.filter(
    (m) => m.plano === 'trial' && m.trial_expira && new Date(m.trial_expira) > now
  ).length
  const pagantes = ms.filter((m) => m.plano && m.plano !== 'trial').length
  const basic = ms.filter((m) => m.plano === 'basic').length
  const pro = ms.filter((m) => m.plano === 'pro').length
  const enterprise = ms.filter((m) => m.plano === 'enterprise').length

  return NextResponse.json({
    funil: [
      { etapa: 'Cadastros', total },
      { etapa: 'Setup concluído', total: setupConcluido },
      { etapa: 'Trials ativos', total: trials },
      { etapa: 'Pagantes', total: pagantes },
    ],
    distribuicaoPlanos: { basic, pro, enterprise },
  })
}

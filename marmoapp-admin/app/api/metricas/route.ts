import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { PLANO_PRECOS } from '@/lib/types'
import type { Marmoraria } from '@/lib/types'
import { subDays, startOfDay } from 'date-fns'

export async function GET() {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const hoje = startOfDay(now).toISOString()
  const semanaAtras = subDays(now, 7).toISOString()

  const [marmorariasRes, assinaturasRes, orcHojeRes, orcSemanaRes] = await Promise.all([
    supabaseAdmin.from('marmorarias').select('id, nome, plano, trial_expira, setup_concluido'),
    supabaseAdmin
      .from('assinaturas')
      .select('*, marmorarias(nome, plano)')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('orcamentos')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hoje),
    supabaseAdmin
      .from('orcamentos')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', semanaAtras),
  ])

  const marmorarias = (marmorariasRes.data ?? []) as Marmoraria[]

  const mrr = marmorarias.reduce((acc, m) => {
    return acc + (m.plano ? (PLANO_PRECOS[m.plano] ?? 0) : 0)
  }, 0)

  const clientesPagantes = marmorarias.filter(
    (m) => m.plano && m.plano !== 'trial'
  ).length

  const trialsAtivos = marmorarias.filter(
    (m) => m.plano === 'trial' && m.trial_expira && new Date(m.trial_expira) > now
  ).length

  const setupConcluido = marmorarias.filter((m) => m.setup_concluido).length
  const taxaActivation =
    marmorarias.length > 0 ? Math.round((setupConcluido / marmorarias.length) * 100) : 0

  return NextResponse.json({
    mrr,
    arr: mrr * 12,
    clientesPagantes,
    trialsAtivos,
    totalCadastros: marmorarias.length,
    taxaActivation,
    orcamentosHoje: orcHojeRes.count ?? 0,
    orcamentosSemana: orcSemanaRes.count ?? 0,
    assinaturas: assinaturasRes.data ?? [],
  })
}

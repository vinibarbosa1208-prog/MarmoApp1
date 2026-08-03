import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { PLANO_PRECOS } from '@/lib/types'
import type { Marmoraria, Orcamento } from '@/lib/types'
import { subDays, startOfDay, format } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const hoje = startOfDay(now).toISOString()
  const amanha = startOfDay(subDays(now, -1)).toISOString()
    .replace(/T.*/, `T${now.getTimezoneOffset() < 0 ? '03' : '00'}:00:00.000Z`)
  const ontemInicio = startOfDay(subDays(now, 1)).toISOString()
  const catorze = subDays(now, 14).toISOString()

  const [marmorariasRes, orcHojeRes, triaisExpirandoRes, novosCadastrosRes, orcamentosRes] =
    await Promise.all([
      supabaseAdmin.from('marmorarias').select('id, nome, plano, trial_expira, setup_concluido'),
      supabaseAdmin
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hoje),
      supabaseAdmin
        .from('marmorarias')
        .select('id, nome, trial_expira')
        .eq('plano', 'trial')
        .gte('trial_expira', hoje)
        .lt('trial_expira', amanha),
      supabaseAdmin
        .from('marmorarias')
        .select('id, nome, plano, created_at', { count: 'exact' })
        .gte('created_at', ontemInicio)
        .lt('created_at', hoje),
      supabaseAdmin
        .from('orcamentos')
        .select('marmoraria_id, created_at')
        .order('created_at', { ascending: false }),
    ])

  const marmorarias = (marmorariasRes.data ?? []) as Marmoraria[]
  const orcamentos = (orcamentosRes.data ?? []) as Orcamento[]

  const mrr = marmorarias.reduce(
    (acc, m) => acc + (m.plano ? (PLANO_PRECOS[m.plano] ?? 0) : 0),
    0
  )
  const pagantes = marmorarias.filter((m) => m.plano && m.plano !== 'trial').length
  const trials = marmorarias.filter(
    (m) => m.plano === 'trial' && m.trial_expira && new Date(m.trial_expira) > now
  ).length

  // Churn risk
  const latestByMarmoraria: Record<string, string> = {}
  for (const o of orcamentos) {
    if (!latestByMarmoraria[o.marmoraria_id]) latestByMarmoraria[o.marmoraria_id] = o.created_at
  }
  const emRisco = marmorarias
    .filter(
      (m) =>
        m.plano &&
        m.plano !== 'trial' &&
        (!latestByMarmoraria[m.id] || new Date(latestByMarmoraria[m.id]) < new Date(catorze))
    )
    .slice(0, 5)

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { text-align: center; margin-bottom: 32px; }
  .title { font-size: 24px; font-weight: 700; color: #818cf8; margin: 0; }
  .subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0; }
  .section { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .metric { background: #0f172a; border-radius: 8px; padding: 12px 16px; }
  .metric-label { font-size: 11px; color: #475569; margin: 0 0 4px; }
  .metric-value { font-size: 22px; font-weight: 700; margin: 0; }
  .green { color: #34d399; } .blue { color: #60a5fa; } .yellow { color: #fbbf24; } .purple { color: #a78bfa; }
  .risk-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
  .risk-row:last-child { border: none; }
  .tag { display: inline-block; border-radius: 20px; padding: 2px 10px; font-size: 11px; }
  .trial-tag { background: #422006; color: #fbbf24; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 32px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 class="title">MarmoApp</h1>
    <p class="subtitle">Relatório diário — ${format(now, 'dd/MM/yyyy')}</p>
  </div>

  <div class="section">
    <p class="section-title">Receita</p>
    <div class="grid">
      <div class="metric"><p class="metric-label">MRR</p><p class="metric-value green">${formatBRL(mrr)}</p></div>
      <div class="metric"><p class="metric-label">ARR</p><p class="metric-value green">${formatBRL(mrr * 12)}</p></div>
      <div class="metric"><p class="metric-label">Clientes pagantes</p><p class="metric-value blue">${pagantes}</p></div>
      <div class="metric"><p class="metric-label">Trials ativos</p><p class="metric-value yellow">${trials}</p></div>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Atividade nas últimas 24h</p>
    <div class="grid">
      <div class="metric"><p class="metric-label">Novos cadastros</p><p class="metric-value purple">${novosCadastrosRes.count ?? 0}</p></div>
      <div class="metric"><p class="metric-label">Orçamentos criados</p><p class="metric-value blue">${orcHojeRes.count ?? 0}</p></div>
    </div>
  </div>

  ${
    (triaisExpirandoRes.data?.length ?? 0) > 0
      ? `<div class="section">
    <p class="section-title">Trials expirando hoje (${triaisExpirandoRes.data?.length})</p>
    ${(triaisExpirandoRes.data ?? []).map((t: { nome: string }) => `<div class="risk-row"><span>${t.nome}</span><span class="tag trial-tag">trial</span></div>`).join('')}
  </div>`
      : ''
  }

  ${
    emRisco.length > 0
      ? `<div class="section">
    <p class="section-title">Clientes em risco de churn</p>
    ${emRisco.map((m) => `<div class="risk-row"><span>${m.nome}</span><span style="color:#f87171;font-size:12px">+14 dias sem uso</span></div>`).join('')}
  </div>`
      : ''
  }

  <div class="footer">MarmoApp Admin · ${process.env.NEXT_PUBLIC_APP_URL}</div>
</div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'relatorios@marmoapp.com',
    to: 'contato@marmoapp.com',
    subject: `📊 MarmoApp — Relatório ${format(now, 'dd/MM/yyyy')} | MRR ${formatBRL(mrr)}`,
    html,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Falha ao enviar email', detail: error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    mrr,
    pagantes,
    trials,
    orcamentosHoje: orcHojeRes.count ?? 0,
    trialsExpirando: triaisExpirandoRes.data?.length ?? 0,
    emRisco: emRisco.length,
  })
}

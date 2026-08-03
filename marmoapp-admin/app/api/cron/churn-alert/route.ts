import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { subDays, format } from 'date-fns'
import type { Marmoraria, Orcamento } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const catorzeAtras = subDays(now, 14).toISOString()

  const [marmorariasRes, orcamentosRes] = await Promise.all([
    supabaseAdmin
      .from('marmorarias')
      .select('id, nome, plano, created_at')
      .not('plano', 'is', null)
      .neq('plano', 'trial'),
    supabaseAdmin
      .from('orcamentos')
      .select('marmoraria_id, created_at')
      .order('created_at', { ascending: false }),
  ])

  const marmorarias = (marmorariasRes.data ?? []) as Marmoraria[]
  const orcamentos = (orcamentosRes.data ?? []) as Orcamento[]

  const latestByMarmoraria: Record<string, string> = {}
  for (const o of orcamentos) {
    if (!latestByMarmoraria[o.marmoraria_id]) {
      latestByMarmoraria[o.marmoraria_id] = o.created_at
    }
  }

  const emRisco = marmorarias
    .map((m) => ({
      ...m,
      ultimo_orcamento: latestByMarmoraria[m.id] ?? null,
      dias_sem_uso: latestByMarmoraria[m.id]
        ? Math.floor((now.getTime() - new Date(latestByMarmoraria[m.id]).getTime()) / 86400000)
        : null,
    }))
    .filter(
      (m) =>
        !latestByMarmoraria[m.id] ||
        new Date(latestByMarmoraria[m.id]) < new Date(catorzeAtras)
    )
    .sort((a, b) => (b.dias_sem_uso ?? 999) - (a.dias_sem_uso ?? 999))

  if (emRisco.length === 0) {
    return NextResponse.json({ success: true, emRisco: 0 })
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .title { font-size: 22px; font-weight: 700; color: #f87171; }
  .section { background: #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing:.05em; color: #64748b; margin: 0 0 16px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155; font-size: 13px; align-items: center; }
  .row:last-child { border: none; }
  .badge { padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-red { background: #450a0a; color: #f87171; }
  .badge-yellow { background: #422006; color: #fbbf24; }
  .btn { display: inline-block; background: #334155; color: #e2e8f0; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; margin-top: 16px; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 32px; }
</style></head>
<body>
<div class="container">
  <p class="title">⚠️ Alerta de Churn — ${emRisco.length} cliente${emRisco.length > 1 ? 's' : ''} em risco</p>
  <p style="color:#94a3b8;font-size:14px">
    ${format(now, 'dd/MM/yyyy HH:mm')} — Clientes pagantes sem atividade há mais de 14 dias.
  </p>

  <div class="section">
    <p class="section-title">Clientes sem atividade</p>
    ${emRisco
      .map(
        (m) => `
    <div class="row">
      <div>
        <div style="font-weight:600">${m.nome}</div>
        <div style="color:#64748b;font-size:11px;margin-top:2px">Plano: ${m.plano ?? '—'} · Último orçamento: ${m.ultimo_orcamento ? format(new Date(m.ultimo_orcamento), 'dd/MM/yyyy') : 'nunca'}</div>
      </div>
      <span class="badge ${(m.dias_sem_uso ?? 999) > 21 ? 'badge-red' : 'badge-yellow'}">
        ${m.dias_sem_uso ?? '∞'} dias
      </span>
    </div>`
      )
      .join('')}
  </div>

  <a href="${process.env.NEXT_PUBLIC_APP_URL}/clientes" class="btn">Ver no painel →</a>

  <div class="footer">MarmoApp Admin · gerado automaticamente</div>
</div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'relatorios@marmoapp.com',
    to: 'contato@marmoapp.com',
    subject: `⚠️ ${emRisco.length} cliente${emRisco.length > 1 ? 's' : ''} em risco de churn — ${format(now, 'dd/MM/yyyy')}`,
    html,
  })

  if (error) {
    return NextResponse.json({ error: 'Falha ao enviar email', detail: error }, { status: 500 })
  }

  return NextResponse.json({ success: true, emRisco: emRisco.length })
}

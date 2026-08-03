import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { addDays, startOfDay } from 'date-fns'
import { PLANO_PRECOS } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const tomorrow = startOfDay(addDays(now, 1)).toISOString()
  const dayAfterTomorrow = startOfDay(addDays(now, 2)).toISOString()

  // Trials expiring in ~1 day (day 6 of 7-day trial)
  const { data: trials } = await supabaseAdmin
    .from('marmorarias')
    .select('id, nome, trial_expira')
    .eq('plano', 'trial')
    .gte('trial_expira', tomorrow)
    .lt('trial_expira', dayAfterTomorrow)

  if (!trials || trials.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  const marmorariaIds = trials.map((t) => t.id)
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('marmoraria_id, email')
    .in('marmoraria_id', marmorariaIds)
    .not('email', 'is', null)

  const emailByMarmoraria: Record<string, string> = {}
  for (const u of usuarios ?? []) {
    if (u.email && !emailByMarmoraria[u.marmoraria_id]) {
      emailByMarmoraria[u.marmoraria_id] = u.email
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace('admin.', '') ?? 'https://marmoapp.com'

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const trial of trials) {
    const email = emailByMarmoraria[trial.id]
    if (!email) continue

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .title { font-size: 22px; font-weight: 700; color: #f87171; }
  .section { background: #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
  .plan { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; cursor: pointer; border: 2px solid transparent; }
  .plan-basic { background: #1e3a5f; border-color: #3b82f6; }
  .plan-pro { background: #2d1f69; border-color: #818cf8; }
  .plan-name { font-weight: 700; font-size: 16px; }
  .plan-price { font-size: 20px; font-weight: 700; color: #34d399; }
  .plan-desc { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .cta { display: block; text-align: center; background: #818cf8; color: #fff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin-top: 24px; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 32px; }
  .alert { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; color: #fca5a5; font-size: 14px; }
</style></head>
<body>
<div class="container">
  <p class="title">Seu trial expira amanhã ⏰</p>
  <p style="color:#94a3b8">Olá, <strong>${trial.nome}</strong>! Seu período gratuito de 7 dias termina amanhã.</p>

  <div class="alert">
    Após o vencimento, sua conta será pausada e você perderá acesso aos seus orçamentos e dados.
  </div>

  <div class="section">
    <p style="font-size:13px; color:#64748b; margin:0 0 12px; text-transform:uppercase; letter-spacing:.05em; font-weight:600">Escolha seu plano</p>

    <div class="plan plan-basic">
      <div>
        <div class="plan-name">Basic</div>
        <div class="plan-desc">Até 3 usuários · Orçamentos ilimitados</div>
      </div>
      <div class="plan-price">${formatBRL(PLANO_PRECOS.basic)}<span style="font-size:12px;color:#94a3b8">/mês</span></div>
    </div>

    <div class="plan plan-pro">
      <div>
        <div class="plan-name" style="color:#a78bfa">Pro ⭐</div>
        <div class="plan-desc">Usuários ilimitados · Relatórios avançados · Suporte prioritário</div>
      </div>
      <div class="plan-price">${formatBRL(PLANO_PRECOS.pro)}<span style="font-size:12px;color:#94a3b8">/mês</span></div>
    </div>
  </div>

  <a href="${appUrl}/assinar" class="cta">Assinar agora e continuar sem interrupção →</a>

  <p style="text-align:center; color:#475569; font-size:13px; margin-top:16px">
    Dúvidas? Responda este email ou fale no WhatsApp.
  </p>

  <div class="footer">MarmoApp · <a href="mailto:contato@marmoapp.com" style="color:#475569">contato@marmoapp.com</a></div>
</div>
</body>
</html>`

    const { error } = await resend.emails.send({
      from: 'MarmoApp <onboarding@marmoapp.com>',
      to: email,
      subject: `⏰ Seu trial expira amanhã — assine agora e não perca acesso`,
      html,
    })

    if (!error) sent++
  }

  return NextResponse.json({ success: true, sent, total: trials.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { subDays, startOfDay } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const day2Start = startOfDay(subDays(now, 2)).toISOString()
  const day2End = startOfDay(subDays(now, 1)).toISOString()

  const { data: trials } = await supabaseAdmin
    .from('marmorarias')
    .select('id, nome')
    .eq('plano', 'trial')
    .gte('created_at', day2Start)
    .lt('created_at', day2End)

  if (!trials || trials.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  // Get owner emails for each trial
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
  .title { font-size: 22px; font-weight: 700; color: #818cf8; }
  .section { background: #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
  .tip { padding: 10px 0; border-bottom: 1px solid #334155; font-size: 14px; }
  .tip:last-child { border: none; }
  .cta { display: inline-block; background: #818cf8; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 32px; }
</style></head>
<body>
<div class="container">
  <p class="title">Olá, ${trial.nome}! 👋</p>
  <p style="color:#94a3b8">Você está no <strong>dia 2</strong> do seu trial gratuito do MarmoApp. Aqui estão as dicas para tirar o máximo proveito:</p>

  <div class="section">
    <div class="tip">✅ <strong>Crie seu primeiro orçamento</strong> — leva menos de 2 minutos</div>
    <div class="tip">📦 <strong>Cadastre seus materiais e acabamentos</strong> para agilizar os próximos orçamentos</div>
    <div class="tip">👥 <strong>Adicione sua equipe</strong> para trabalhar em conjunto</div>
    <div class="tip">📱 <strong>Acesse pelo celular</strong> — o MarmoApp funciona em qualquer dispositivo</div>
  </div>

  <p style="color:#94a3b8">Você tem <strong>5 dias restantes</strong> no trial. Aproveite para explorar tudo!</p>
  <a href="${process.env.NEXT_PUBLIC_APP_URL?.replace('admin.', '')}" class="cta">Acessar o MarmoApp</a>

  <div class="footer">MarmoApp · <a href="mailto:contato@marmoapp.com" style="color:#475569">contato@marmoapp.com</a></div>
</div>
</body>
</html>`

    const { error } = await resend.emails.send({
      from: 'MarmoApp <onboarding@marmoapp.com>',
      to: email,
      subject: `Dia 2 do seu trial — dicas para começar com o MarmoApp`,
      html,
    })

    if (!error) sent++
  }

  return NextResponse.json({ success: true, sent, total: trials.length })
}

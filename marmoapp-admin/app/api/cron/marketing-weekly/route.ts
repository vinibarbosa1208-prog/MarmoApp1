import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { subDays, startOfDay, format, getISOWeek } from 'date-fns'

export const runtime = 'nodejs'

// Roda toda segunda-feira às 7h UTC (4h BRT)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const semanaInicio = startOfDay(subDays(now, 7)).toISOString()
  const semanaFim = startOfDay(now).toISOString()

  // Semana do ciclo (1-4, rotativo)
  const ciclo = ((getISOWeek(now) - 1) % 4) + 1

  const [leadsRes, trialsRes, conversoesRes] = await Promise.all([
    // Novos cadastros na semana (marmorarias criadas)
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', semanaInicio)
      .lt('created_at', semanaFim),

    // Trials ativados na semana
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true })
      .eq('plano', 'trial')
      .gte('created_at', semanaInicio)
      .lt('created_at', semanaFim),

    // Conversões: deixou de ser trial e virou pagante
    supabaseAdmin
      .from('marmorarias')
      .select('id, plano', { count: 'exact', head: true })
      .neq('plano', 'trial')
      .not('plano', 'is', null)
      .gte('created_at', semanaInicio)
      .lt('created_at', semanaFim),
  ])

  const leads = leadsRes.count ?? 0
  const trials = trialsRes.count ?? 0
  const conversoes = conversoesRes.count ?? 0

  const temasRotativos: Record<number, string> = {
    1: 'DOR FINANCEIRA — "Quanto você perde por mês sem controle de margem?"',
    2: 'SOLUÇÃO — "Como o MarmoApp calcula orçamento em 2 minutos"',
    3: 'PROVA SOCIAL — "Como a Real Pedras (Arujá-SP) organiza a produção"',
    4: 'PRODUTO — "O que é o Agente Antônio e como funciona"',
  }

  const tema = temasRotativos[ciclo]
  const periodoLabel = `${format(subDays(now, 7), 'dd/MM')} a ${format(subDays(now, 1), 'dd/MM/yyyy')}`
  const adminUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin.marmoapp.com'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { text-align: center; margin-bottom: 32px; }
  .title { font-size: 22px; font-weight: 700; color: #818cf8; margin: 0; }
  .subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0; }
  .section { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #334155; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing:.05em; color: #64748b; margin: 0 0 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .metric { background: #0f172a; border-radius: 8px; padding: 12px 14px; text-align: center; }
  .metric-label { font-size: 11px; color: #475569; margin: 0 0 4px; }
  .metric-value { font-size: 26px; font-weight: 700; margin: 0; }
  .green { color: #34d399; } .blue { color: #60a5fa; } .purple { color: #a78bfa; }
  .todo { background: #0f172a; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .todo-num { display: inline-block; background: #818cf8; color: #fff; width: 22px; height: 22px; border-radius: 50%; text-align: center; line-height: 22px; font-size: 12px; font-weight: 700; margin-right: 8px; }
  .todo-text { font-size: 14px; color: #e2e8f0; }
  .todo-sub { font-size: 12px; color: #64748b; margin: 4px 0 0 30px; font-family: monospace; }
  .highlight { background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; }
  .highlight-label { font-size: 11px; color: #60a5fa; font-weight: 600; margin: 0 0 4px; }
  .highlight-value { font-size: 14px; color: #e2e8f0; margin: 0; }
  .cta { display: block; text-align: center; background: #818cf8; color: #fff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 20px 0; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 28px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 class="title">MarmoApp</h1>
    <p class="subtitle">Segunda-feira — semana de marketing · ${format(now, 'dd/MM/yyyy')}</p>
  </div>

  <div class="section">
    <p class="section-title">Semana passada (${periodoLabel})</p>
    <div class="grid">
      <div class="metric">
        <p class="metric-label">Novos leads</p>
        <p class="metric-value blue">${leads}</p>
      </div>
      <div class="metric">
        <p class="metric-label">Trials ativados</p>
        <p class="metric-value purple">${trials}</p>
      </div>
      <div class="metric">
        <p class="metric-label">Conversões</p>
        <p class="metric-value green">${conversoes}</p>
      </div>
    </div>
  </div>

  <div class="highlight">
    <p class="highlight-label">Tema desta semana (ciclo ${ciclo}/4)</p>
    <p class="highlight-value">${tema}</p>
  </div>

  <div class="section">
    <p class="section-title">Para fazer hoje</p>

    <div class="todo">
      <span class="todo-num">1</span>
      <span class="todo-text">Abra o Claude Code na pasta marmoapp-admin</span>
    </div>

    <div class="todo">
      <span class="todo-num">2</span>
      <span class="todo-text">Acione o agente editorial</span>
      <p class="todo-sub">Digite: "Aja como marketing-editorial. Estamos na semana ${ciclo} do ciclo. Gere o pacote completo."</p>
    </div>

    <div class="todo">
      <span class="todo-num">3</span>
      <span class="todo-text">Revise os 4 carrosséis e 4 legendas gerados</span>
    </div>

    <div class="todo">
      <span class="todo-num">4</span>
      <span class="todo-text">Publique 1 post por dia: terça a sexta</span>
    </div>
  </div>

  <a href="${adminUrl}/marketing" class="cta">Abrir painel de marketing →</a>

  <div class="footer">MarmoApp Admin · gerado automaticamente toda segunda-feira às 7h UTC</div>
</div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'relatorios@marmoapp.com',
    to: 'viniciusbarbosa@marmoapp.com',
    subject: `📅 Segunda-feira MarmoApp — ${leads} leads semana passada · Semana ${ciclo} do ciclo`,
    html,
  })

  if (error) {
    return NextResponse.json({ error: 'Falha ao enviar email', detail: error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    ciclo,
    leads,
    trials,
    conversoes,
    periodo: periodoLabel,
  })
}

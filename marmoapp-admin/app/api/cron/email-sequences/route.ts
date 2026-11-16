import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { subDays, addDays, startOfDay } from 'date-fns'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin.marmoapp.com'
const MARMOAPP_URL = 'https://marmoapp.com'
const WHATSAPP = 'https://wa.me/5511999999999?text=Ol%C3%A1%20Vinicius%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20MarmoApp'
const FROM = 'MarmoApp <onboarding@marmoapp.com>'

// Evita duplicatas: só envia se não existe registro em email_logs
async function alreadySent(leadId: string | null, marmorariaId: string | null, emailType: string) {
  if (leadId) {
    const { data } = await supabaseAdmin
      .from('email_logs')
      .select('id')
      .eq('lead_id', leadId)
      .eq('email_type', emailType)
      .maybeSingle()
    return !!data
  }
  if (marmorariaId) {
    const { data } = await supabaseAdmin
      .from('email_logs')
      .select('id')
      .eq('marmoraria_id', marmorariaId)
      .eq('email_type', emailType)
      .maybeSingle()
    return !!data
  }
  return false
}

async function logEmail(leadId: string | null, marmorariaId: string | null, emailType: string, sentTo: string) {
  try {
    await supabaseAdmin.from('email_logs').insert({
      lead_id: leadId,
      marmoraria_id: marmorariaId,
      email_type: emailType,
      sent_to: sentTo,
    })
  } catch {
    // Ignora conflito de unique constraint (já enviado)
  }
}

function baseHtml(content: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF9F7;margin:0;padding:0;color:#2C2922}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #EDE9E2;overflow:hidden}
  .top{background:#2C2922;padding:20px 32px;text-align:center}
  .logo{font-size:20px;font-weight:700;color:#fff}
  .logo span{color:#C9A84C}
  .body{padding:28px 32px}
  p{font-size:15px;line-height:1.7;color:#2C2922;margin:0 0 14px}
  .btn{display:inline-block;background:#C9A84C;color:#2C2922;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 14px}
  .btn-outline{display:inline-block;color:#C9A84C;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;border:1.5px solid #C9A84C}
  .divider{border:none;border-top:1px solid #EDE9E2;margin:20px 0}
  .footer{background:#F5F3EF;padding:16px 32px;text-align:center;font-size:12px;color:#9B8A7A}
  .footer a{color:#C9A84C;text-decoration:none}
  .highlight{background:#FBF7EE;border-left:3px solid #C9A84C;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0}
  ol{padding-left:18px;margin:0 0 14px}
  ol li{font-size:15px;line-height:1.7;margin-bottom:6px}
</style></head>
<body><div class="wrap">
  <div class="top"><div class="logo">Marmo<span>App</span></div></div>
  <div class="body">${content}</div>
  <div class="footer">
    MarmoApp · <a href="${MARMOAPP_URL}">marmoapp.com</a> · <a href="${WHATSAPP}">WhatsApp</a>
  </div>
</div></body></html>`
}

// Roda todo dia às 12h UTC (9h BRT)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const results = { activation: 0, value: 0, urgency: 0, lastChance: 0, reengagement: 0, errors: [] as string[] }

  // ── Email 2: Ativação (leads de 24h que ainda não fizeram orçamento) ──
  const d1Start = startOfDay(subDays(now, 1)).toISOString()
  const d1End = startOfDay(now).toISOString()
  const { data: leadsD1 } = await supabaseAdmin
    .from('leads')
    .select('id, nome_contato, email')
    // Só leads do teste grátis do MarmoApp; os da MarmorarIA seguem pelo WhatsApp.
    .eq('origem', 'landing_page')
    .not('email', 'is', null)
    .gte('created_at', d1Start)
    .lt('created_at', d1End)
    .eq('status', 'novo')

  for (const lead of leadsD1 ?? []) {
    if (await alreadySent(lead.id, null, 'activation')) continue
    const html = baseHtml(`
      <p>Oi <strong>${lead.nome_contato}</strong>,</p>
      <p>Vi que você se cadastrou ontem mas ainda não criou nenhum orçamento. 👀</p>
      <p>Leva literalmente <strong>2 minutos</strong>:</p>
      <ol>
        <li>Acesse <strong>${MARMOAPP_URL}/orcamentos</strong></li>
        <li>Clique em <strong>"Novo orçamento"</strong></li>
        <li>Selecione cliente, material e medidas</li>
        <li>Pronto — orçamento gerado com margem calculada</li>
      </ol>
      <div style="text-align:center;margin:20px 0">
        <a href="${MARMOAPP_URL}/orcamentos" class="btn">Fazer meu primeiro orçamento →</a>
      </div>
      <p style="font-size:13px;color:#9B8A7A">Qualquer dúvida, responda esse email.</p>
      <p><strong>Vinicius</strong></p>
    `)
    try {
      const { error } = await resend.emails.send({ from: FROM, to: lead.email, subject: `Sua marmoraria ainda não fez o primeiro orçamento 👀`, html })
      if (!error) { await logEmail(lead.id, null, 'activation', lead.email); results.activation++ }
    } catch (e) { results.errors.push(`activation:${lead.email}`) }
  }

  // ── Email 3: Valor (leads de 3 dias) ──
  const d3Start = startOfDay(subDays(now, 3)).toISOString()
  const d3End = startOfDay(subDays(now, 2)).toISOString()
  const { data: leadsD3 } = await supabaseAdmin
    .from('leads')
    .select('id, nome_contato, email')
    // Só leads do teste grátis do MarmoApp; os da MarmorarIA seguem pelo WhatsApp.
    .eq('origem', 'landing_page')
    .not('email', 'is', null)
    .gte('created_at', d3Start)
    .lt('created_at', d3End)

  for (const lead of leadsD3 ?? []) {
    if (await alreadySent(lead.id, null, 'value')) continue
    const html = baseHtml(`
      <p>Oi <strong>${lead.nome_contato}</strong>,</p>
      <p>Uma pergunta direta: <strong>na última obra entregue, você sabia exatamente sua margem de lucro?</strong></p>
      <div class="highlight">
        <p style="margin:0;font-weight:600">Exemplo real — pia de granito preto 1,5m × 0,6m:</p>
        <p style="margin:10px 0 0;font-size:14px">
          Chapa: R$180 · Mão de obra: R$120 · Transporte: R$40<br>
          <strong>Custo total: R$340 · Orçamento dado: R$380</strong><br>
          <span style="color:#C0392B;font-weight:700">Margem real: 11,7% — pouco demais para o risco.</span>
        </p>
      </div>
      <p>Com o MarmoApp, você vê essa margem <strong>antes de confirmar para o cliente</strong>.</p>
      <div style="text-align:center;margin:20px 0">
        <a href="${MARMOAPP_URL}/orcamentos" class="btn">Ver minha margem no próximo orçamento →</a>
      </div>
      <p><strong>Vinicius</strong></p>
    `)
    try {
      const { error } = await resend.emails.send({ from: FROM, to: lead.email, subject: `Quanto você perde por mês em orçamentos errados?`, html })
      if (!error) { await logEmail(lead.id, null, 'value', lead.email); results.value++ }
    } catch (e) { results.errors.push(`value:${lead.email}`) }
  }

  // E-mails 4, 5 e 6 (fim do teste grátis e reativação) removidos: não há mais teste grátis.

  return NextResponse.json({ success: true, ...results })
}

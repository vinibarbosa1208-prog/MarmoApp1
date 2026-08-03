import { Resend } from 'resend'

// Lazy — avoids build-time error when env var is absent
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? '')
}

const FROM = 'MarmoApp <onboarding@marmoapp.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://marmoapp.com'
const WHATSAPP = 'https://wa.me/5511999999999?text=Ol%C3%A1%20Vinicius%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20MarmoApp'

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF9F7;margin:0;padding:0;color:#2C2922}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #EDE9E2;overflow:hidden}
  .top{background:#2C2922;padding:24px 32px;text-align:center}
  .logo{font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px}
  .logo span{color:#C9A84C}
  .body{padding:32px}
  p{font-size:15px;line-height:1.7;color:#2C2922;margin:0 0 16px}
  .btn{display:inline-block;background:#C9A84C;color:#2C2922;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 16px}
  .btn-outline{display:inline-block;background:transparent;color:#C9A84C;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #C9A84C;margin:4px 0}
  .divider{border:none;border-top:1px solid #EDE9E2;margin:24px 0}
  .footer{background:#F5F3EF;padding:20px 32px;text-align:center;font-size:12px;color:#9B8A7A}
  .footer a{color:#C9A84C;text-decoration:none}
  .sig{font-style:italic;color:#9B8A7A;font-size:13px;margin-top:8px}
  .highlight{background:#FBF7EE;border-left:3px solid #C9A84C;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0}
  ol{padding-left:20px;margin:0 0 16px}
  ol li{font-size:15px;line-height:1.7;color:#2C2922;margin-bottom:8px}
</style></head>
<body>
<div class="wrap">
  <div class="top"><div class="logo">Marmo<span>App</span></div></div>
  <div class="body">${content}</div>
  <div class="footer">
    MarmoApp · marmoraria inteligente<br>
    <a href="${APP_URL}">marmoapp.com</a> ·
    <a href="${WHATSAPP}">WhatsApp</a> ·
    <a href="https://instagram.com/marmoapp_oficial">@marmoapp_oficial</a>
  </div>
</div>
</body></html>`
}

export async function sendWelcomeEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Que bom ter você aqui! 🎉</p>
    <p>Você acabou de dar o primeiro passo para nunca mais perder margem em um orçamento de mármore ou granito.</p>
    <p>Nos próximos <strong>7 dias</strong>, você tem acesso completo ao MarmoApp. Veja o que fazer agora:</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${APP_URL}/dashboard" class="btn">Acessar meu painel →</a>
    </div>
    <div class="highlight">
      <p style="margin:0;font-weight:600">Seu primeiro passo:</p>
      <p style="margin:8px 0 0">Cadastre 3 materiais que você mais usa (granito, mármore, quartzito) e faça um orçamento de teste. Leva 5 minutos e você vai ver a diferença.</p>
    </div>
    <hr class="divider">
    <p>Qualquer dúvida, me chama no WhatsApp — respondo pessoalmente:</p>
    <div style="text-align:center">
      <a href="${WHATSAPP}" class="btn-outline">Falar com o Vinicius no WhatsApp</a>
    </div>
    <hr class="divider">
    <p>Abraço,</p>
    <p><strong>Vinicius Barbosa</strong><br><span class="sig">Fundador do MarmoApp</span></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Bem-vindo ao MarmoApp, ${nome}! Seu trial começa agora 🎉`,
    html,
  })
}

export async function sendActivationEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Vi que você se cadastrou ontem mas ainda não criou nenhum orçamento. 👀</p>
    <p>Entendo — às vezes a gente cadastra e fica pra depois. Mas deixa eu te mostrar como é rápido:</p>
    <ol>
      <li>Acesse <strong>marmoapp.com/orcamentos</strong></li>
      <li>Clique em <strong>"Novo orçamento"</strong></li>
      <li>Selecione cliente, material e medidas</li>
      <li>Pronto — orçamento gerado</li>
    </ol>
    <p>Isso leva literalmente <strong>2 minutos</strong>.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${APP_URL}/orcamentos" class="btn">Fazer meu primeiro orçamento →</a>
    </div>
    <hr class="divider">
    <p style="font-size:13px;color:#9B8A7A">Se precisar de ajuda, é só responder esse email.</p>
    <p><strong>Vinicius</strong></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Sua marmoraria ainda não fez o primeiro orçamento 👀`,
    html,
  })
}

export async function sendValueEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Deixa eu te fazer uma pergunta direta:</p>
    <p><strong>Na última vez que você entregou uma obra, você sabia exatamente qual foi sua margem de lucro?</strong></p>
    <p>A maioria dos marmoreiros que conheço responde <em>"mais ou menos"</em> ou <em>"acho que foi bom"</em>.</p>
    <p>O problema está no <strong>"acho"</strong>.</p>
    <div class="highlight">
      <p style="margin:0;font-weight:600">Uma pia de granito preto, 1,5m × 0,6m:</p>
      <p style="margin:12px 0 0;font-size:14px">
        Chapa: R$180 (área + perda de 15%)<br>
        Mão de obra: R$120<br>
        Transporte: R$40<br>
        <strong>Total custo: R$340</strong><br>
        Orçamento dado: R$380<br><br>
        <span style="color:#C0392B;font-weight:700">Margem real: 11,7% — isso é pouco demais para o risco que você corre.</span>
      </p>
    </div>
    <p>Com o MarmoApp, você vê essa margem <strong>antes de confirmar para o cliente</strong>. E ajusta na hora.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${APP_URL}/orcamentos" class="btn">Ver minha margem no próximo orçamento →</a>
    </div>
    <p><strong>Vinicius</strong></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Quanto você perde por mês em orçamentos errados?`,
    html,
  })
}

export async function sendUrgencyEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Seu período de teste gratuito <strong>expira em 2 dias</strong>. ⏰</p>
    <p>Se o MarmoApp te ajudou a organizar seus orçamentos e controlar sua margem, agora é a hora de garantir seu acesso.</p>
    <p><strong>O plano que mais combina com sua marmoraria:</strong></p>
    <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0">
      <a href="${APP_URL}/pricing?plano=basic" style="display:block;padding:14px 20px;border:1px solid #EDE9E2;border-radius:8px;text-decoration:none;color:#2C2922">
        <strong>Basic — R$147/mês</strong><br>
        <span style="font-size:13px;color:#9B8A7A">Orçamentos ilimitados + controle de preços</span>
      </a>
      <a href="${APP_URL}/pricing?plano=pro" style="display:block;padding:14px 20px;border:2px solid #C9A84C;border-radius:8px;text-decoration:none;color:#2C2922;background:#FBF7EE">
        <strong>⭐ Pro — R$297/mês</strong><br>
        <span style="font-size:13px;color:#9B8A7A">+ Produção + relatórios + multi-usuário</span>
      </a>
      <a href="${APP_URL}/pricing?plano=enterprise" style="display:block;padding:14px 20px;border:1px solid #EDE9E2;border-radius:8px;text-decoration:none;color:#2C2922">
        <strong>Enterprise — R$497/mês</strong><br>
        <span style="font-size:13px;color:#9B8A7A">+ Antônio (IA no WhatsApp)</span>
      </a>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${APP_URL}/pricing" class="btn">Ver planos e assinar →</a>
    </div>
    <p style="font-size:13px;color:#9B8A7A">Se quiser conversar antes de decidir, me chama no <a href="${WHATSAPP}" style="color:#C9A84C">WhatsApp</a>.</p>
    <p><strong>Vinicius</strong></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Seu trial do MarmoApp expira em 2 dias ⏰`,
    html,
  })
}

export async function sendLastChanceEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Hoje é o <strong>último dia</strong> do seu trial gratuito. 🔔</p>
    <p>A partir de amanhã, você precisa de um plano ativo para continuar usando o MarmoApp.</p>
    <p>Se já está usando e viu valor — não deixa para depois.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${APP_URL}/pricing" class="btn">Garantir meu acesso agora →</a>
    </div>
    <hr class="divider">
    <p>Se ainda tem dúvidas, me chama agora mesmo:</p>
    <div style="text-align:center">
      <a href="${WHATSAPP}" class="btn-outline">Falar no WhatsApp</a>
    </div>
    <p style="margin-top:24px"><strong>Vinicius</strong></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Último dia do seu trial — não perca o acesso 🔔`,
    html,
  })
}

export async function sendReengagementEmail(to: string, nome: string) {
  const html = baseHtml(`
    <p>Oi <strong>${nome}</strong>,</p>
    <p>Faz uma semana que seu trial expirou e ainda não vi você por aqui.</p>
    <p>Quero entender o que aconteceu:</p>
    <div class="highlight">
      <p style="margin:0">
        <strong>O preço ficou alto?</strong> Me fala, posso conversar.<br><br>
        <strong>Não teve tempo de testar direito?</strong> Posso reativar por mais 7 dias.<br><br>
        <strong>Preferiu continuar com planilha?</strong> Tudo bem, mas me conta o motivo.
      </p>
    </div>
    <p>É só responder esse email. Leio todos pessoalmente.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${WHATSAPP}" class="btn-outline">Ou me chama no WhatsApp</a>
    </div>
    <p><strong>Vinicius</strong><br><span class="sig">Fundador do MarmoApp</span></p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Ainda pensando no MarmoApp?`,
    html,
  })
}

import { Resend } from 'resend'

const FROM = 'MarmorarIA <onboarding@marmoapp.com>'

async function enviar(to: string, subject: string, text: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({ from: FROM, to, subject, text })
    return !error
  } catch {
    return false
  }
}

export function emailLinkAssinatura(to: string, nome: string, numero: string, link: string) {
  return enviar(
    to,
    `Contrato MarmorarIA nº ${numero} para assinatura`,
    [
      `Olá, ${nome}!`,
      '',
      `Segue o contrato nº ${numero} da MarmorarIA para você ler e assinar online:`,
      link,
      '',
      'Na página você confere o texto completo, confirma seus dados e recebe um código neste e-mail para assinar.',
      '',
      'Qualquer dúvida, é só responder no WhatsApp (11) 94734-0955.',
      'Vinicius — MarmorarIA',
    ].join('\n')
  )
}

export function emailCodigo(to: string, numero: string, codigo: string) {
  return enviar(
    to,
    `Seu código para assinar o contrato ${numero}: ${codigo}`,
    [
      `Seu código para assinar o contrato nº ${numero} da MarmorarIA é: ${codigo}`,
      '',
      'Ele vale por 10 minutos. Se não foi você que pediu, ignore este e-mail.',
    ].join('\n')
  )
}

export function emailContratoAssinado(to: string, numero: string, linkDocumento: string, linkPagamento: string | null) {
  return enviar(
    to,
    `Contrato MarmorarIA nº ${numero} assinado`,
    [
      `O contrato nº ${numero} foi assinado. A via assinada, com o registro da assinatura, fica neste link:`,
      linkDocumento,
      '',
      linkPagamento ? `Link de pagamento da primeira cobrança: ${linkPagamento}` : '',
      'Guarde este e-mail. Vinicius — MarmorarIA',
    ]
      .filter((l) => l !== null)
      .join('\n')
  )
}

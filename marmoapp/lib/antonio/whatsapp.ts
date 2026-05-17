const BASE_URL = process.env.EVOLUTION_API_URL
const API_KEY = process.env.EVOLUTION_API_KEY

export interface WhatsAppTextMessage {
  instance: string
  to: string        // JID completo, ex: "5511999999999@s.whatsapp.net"
  text: string
  delayMs?: number
}

/** Envia uma mensagem de texto via Evolution API */
export async function sendWhatsAppText({
  instance,
  to,
  text,
  delayMs = 800,
}: WhatsAppTextMessage): Promise<boolean> {
  if (!BASE_URL || !API_KEY) {
    console.warn('[whatsapp] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados')
    return false
  }

  const res = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({
      number: to,
      options: { delay: delayMs },
      textMessage: { text },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[whatsapp] Erro ao enviar mensagem:', res.status, body)
    return false
  }

  return true
}

/** Extrai número de telefone de um JID do WhatsApp */
export function jidToPhone(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '')
}

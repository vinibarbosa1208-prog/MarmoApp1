// Cliente mínimo da API v3 do Asaas (só o que a Pia Programada usa).
// Variáveis de ambiente:
//   ASAAS_API_KEY         chave da conta (sandbox ou produção)
//   ASAAS_API_URL         padrão: sandbox. Produção: https://api.asaas.com/v3
//   ASAAS_WEBHOOK_TOKEN   token configurado no webhook do painel do Asaas
// Sem ASAAS_API_KEY o portal funciona em modo manual (Pix por chave +
// baixa feita pelo gestor).

const URL_PADRAO = 'https://api-sandbox.asaas.com/v3'

export function asaasConfigurado(): boolean {
  return !!process.env.ASAAS_API_KEY
}

async function asaas<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.ASAAS_API_URL || URL_PADRAO
  const res = await fetch(base + caminho, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MarmoApp',
      access_token: process.env.ASAAS_API_KEY!,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (corpo as { errors?: { description?: string }[] }).errors?.[0]?.description
    throw new Error(`Asaas ${res.status}: ${msg || 'erro na cobrança'}`)
  }
  return corpo as T
}

export async function asaasCriarCliente(c: {
  nome: string; cpf: string; whatsapp: string; email?: string | null; externalReference: string
}): Promise<string> {
  const r = await asaas<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: c.nome,
      cpfCnpj: c.cpf,
      mobilePhone: c.whatsapp,
      email: c.email || undefined,
      externalReference: c.externalReference,
      notificationDisabled: true, // avisos saem pelo nosso WhatsApp/portal
    }),
  })
  return r.id
}

export interface CobrancaPix {
  id: string
  invoiceUrl: string | null
  pixCopiaCola: string | null
  pixQrBase64: string | null
}

export async function asaasCriarCobrancaPix(p: {
  customerId: string; valor: number; vencimento: string; descricao: string; externalReference: string
}): Promise<CobrancaPix> {
  const pay = await asaas<{ id: string; invoiceUrl?: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: p.customerId,
      billingType: 'PIX',
      value: p.valor,
      dueDate: p.vencimento,
      description: p.descricao,
      externalReference: p.externalReference,
    }),
  })
  let qr: { encodedImage?: string; payload?: string } = {}
  try {
    qr = await asaas(`/payments/${pay.id}/pixQrCode`)
  } catch {
    // O QR às vezes demora alguns segundos; a tela busca de novo depois.
  }
  return {
    id: pay.id,
    invoiceUrl: pay.invoiceUrl ?? null,
    pixCopiaCola: qr.payload ?? null,
    pixQrBase64: qr.encodedImage ?? null,
  }
}

export async function asaasBuscarQr(paymentId: string): Promise<{ pixCopiaCola: string | null; pixQrBase64: string | null }> {
  const qr = await asaas<{ encodedImage?: string; payload?: string }>(`/payments/${paymentId}/pixQrCode`)
  return { pixCopiaCola: qr.payload ?? null, pixQrBase64: qr.encodedImage ?? null }
}

export async function asaasCancelarCobranca(paymentId: string): Promise<void> {
  await asaas(`/payments/${paymentId}`, { method: 'DELETE' })
}

// Cobrança da 1ª mensalidade/implantação no Asaas, logo após a assinatura.
// Ambiente pelo prefixo da chave: $aact_hmlg_ = sandbox, $aact_prod_ = produção.

function baseUrl(key: string): string {
  return key.startsWith('$aact_prod_') ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
}

async function asaas<T>(key: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl(key)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: key, 'User-Agent': 'MarmoApp-Admin' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json as { errors?: { description?: string }[] }).errors?.[0]?.description
    throw new Error(msg || `Asaas respondeu ${res.status}`)
  }
  return json as T
}

export interface CobrancaCriada {
  customerId: string
  paymentId: string
  invoiceUrl: string
}

export async function criarPrimeiraCobranca(opts: {
  nome: string
  documento: string
  email?: string
  whatsapp?: string
  valor: number
  descricao: string
  referencia: string
}): Promise<CobrancaCriada | null> {
  const key = process.env.ASAAS_API_KEY
  if (!key || opts.valor <= 0) return null

  const cliente = await asaas<{ id: string }>(key, '/customers', {
    name: opts.nome,
    cpfCnpj: opts.documento,
    email: opts.email || undefined,
    mobilePhone: opts.whatsapp ? opts.whatsapp.replace(/\D/g, '').slice(-11) : undefined,
    externalReference: opts.referencia,
    notificationDisabled: false,
  })

  const venc = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const dueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(venc)

  const pagamento = await asaas<{ id: string; invoiceUrl: string }>(key, '/payments', {
    customer: cliente.id,
    billingType: 'UNDEFINED', // o cliente escolhe PIX, boleto ou cartão
    value: opts.valor,
    dueDate,
    description: opts.descricao,
    externalReference: opts.referencia,
  })

  return { customerId: cliente.id, paymentId: pagamento.id, invoiceUrl: pagamento.invoiceUrl }
}

// Assinatura do plano MarmoApp pelo Asaas (Pix, boleto ou cartão).
// Ambiente pelo prefixo da chave: $aact_prod_ = produção; qualquer outra = sandbox.
// Só roda no servidor (ASAAS_API_KEY nunca vai para o navegador).

export const VALOR_MARMOAPP = 297

function chave(): string {
  const k = process.env.ASAAS_API_KEY?.trim()
  if (!k) throw new Error('Pagamento indisponível no momento (Asaas não configurado).')
  return k
}

function baseUrl(k: string) {
  return k.startsWith('$aact_prod_') ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
}

export async function asaas<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const k = chave()
  const res = await fetch(`${baseUrl(k)}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', access_token: k, 'User-Agent': 'MarmoApp' },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json as { errors?: { description?: string }[] }).errors?.[0]?.description
    throw new Error(msg || `Asaas respondeu ${res.status}`)
  }
  return json as T
}

/** Data de hoje no fuso de São Paulo, no formato AAAA-MM-DD. */
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function soDigitos(v: string | null | undefined) {
  return (v ?? '').replace(/\D/g, '')
}

export function documentoValido(doc: string) {
  return doc.length === 11 || doc.length === 14
}

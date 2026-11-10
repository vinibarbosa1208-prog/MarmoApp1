import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contratoPorToken } from '@/lib/contrato/publico'
import { cpfValido, soDigitos, type Parte } from '@/lib/contrato/modelo'
import { CODIGO_MAX_ENVIOS, CODIGO_VALIDADE_MIN, hashCodigo, mascararEmail, novoCodigo } from '@/lib/contrato/seguranca'
import { emailCodigo } from '@/lib/contrato/email'

// Passo 1 da assinatura: confere o CPF de quem assina e manda o código ao e-mail do contrato.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = await contratoPorToken(token)
  if (!c) return NextResponse.json({ error: 'Link inválido ou contrato cancelado.' }, { status: 404 })
  if (c.status !== 'enviado') return NextResponse.json({ error: 'Este contrato não está aguardando assinatura.' }, { status: 409 })

  let b: Record<string, unknown> = {}
  try {
    b = await request.json()
  } catch {}
  const cpf = soDigitos(String(b.cpf ?? ''))
  const ct = c.contratante as Parte
  if (!cpfValido(cpf) || cpf !== soDigitos(ct.cpf_representante)) {
    return NextResponse.json({ error: 'O CPF não confere com o de quem assina este contrato.' }, { status: 400 })
  }
  if (!ct.email) return NextResponse.json({ error: 'Contrato sem e-mail para o código. Fale com a MarmorarIA.' }, { status: 400 })
  if ((c.otp_envios ?? 0) >= CODIGO_MAX_ENVIOS) {
    return NextResponse.json({ error: 'Limite de códigos atingido. Fale com a MarmorarIA pelo WhatsApp.' }, { status: 429 })
  }

  const codigo = novoCodigo()
  const { error } = await supabaseAdmin
    .from('contratos')
    .update({
      otp_hash: hashCodigo(codigo, c.id),
      otp_expira_em: new Date(Date.now() + CODIGO_VALIDADE_MIN * 60 * 1000).toISOString(),
      otp_tentativas: 0,
      otp_envios: (c.otp_envios ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', c.id)
    .eq('status', 'enviado')
  if (error) return NextResponse.json({ error: 'Não consegui gerar o código. Tente de novo.' }, { status: 500 })

  const ok = await emailCodigo(ct.email, c.numero, codigo)
  if (!ok) return NextResponse.json({ error: 'Não consegui enviar o e-mail agora. Tente de novo em instantes.' }, { status: 502 })
  return NextResponse.json({ ok: true, email: mascararEmail(ct.email), validade_min: CODIGO_VALIDADE_MIN })
}

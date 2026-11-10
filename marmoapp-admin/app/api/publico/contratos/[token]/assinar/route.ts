import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contratoPorToken } from '@/lib/contrato/publico'
import { cpfValido, PLANOS, soDigitos, TEXTO_ACEITE, type Parte, type PlanoKey } from '@/lib/contrato/modelo'
import { hashTexto } from '@/lib/contrato/hash'
import { CODIGO_MAX_TENTATIVAS, codigoConfere, ipDaRequisicao } from '@/lib/contrato/seguranca'
import { criarPrimeiraCobranca } from '@/lib/contrato/asaas'
import { emailContratoAssinado } from '@/lib/contrato/email'
import { ALLOWED_ADMIN_EMAILS } from '@/lib/types'

// Passo 2: confere o código e registra a assinatura com a trilha de auditoria.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = await contratoPorToken(token)
  if (!c) return NextResponse.json({ error: 'Link inválido ou contrato cancelado.' }, { status: 404 })
  if (c.status !== 'enviado') return NextResponse.json({ error: 'Este contrato não está aguardando assinatura.' }, { status: 409 })

  let b: Record<string, unknown> = {}
  try {
    b = await request.json()
  } catch {}
  const nome = String(b.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const cpf = soDigitos(String(b.cpf ?? ''))
  const codigo = soDigitos(String(b.codigo ?? ''))
  const ct = c.contratante as Parte

  if (b.aceite !== true) return NextResponse.json({ error: 'Marque que leu e concorda com o contrato.' }, { status: 400 })
  if (nome.split(' ').length < 2) return NextResponse.json({ error: 'Escreva seu nome completo.' }, { status: 400 })
  if (!cpfValido(cpf) || cpf !== soDigitos(ct.cpf_representante))
    return NextResponse.json({ error: 'O CPF não confere com o de quem assina este contrato.' }, { status: 400 })
  if (!c.otp_hash || !c.otp_expira_em) return NextResponse.json({ error: 'Peça o código primeiro.' }, { status: 400 })
  if ((c.otp_tentativas ?? 0) >= CODIGO_MAX_TENTATIVAS)
    return NextResponse.json({ error: 'Muitas tentativas. Peça um código novo.' }, { status: 429 })
  if (new Date(c.otp_expira_em).getTime() < Date.now())
    return NextResponse.json({ error: 'O código expirou. Peça um novo.' }, { status: 400 })

  if (codigo.length !== 6 || !codigoConfere(codigo, c.id, c.otp_hash)) {
    await supabaseAdmin.from('contratos').update({ otp_tentativas: (c.otp_tentativas ?? 0) + 1 }).eq('id', c.id)
    return NextResponse.json({ error: 'Código incorreto.' }, { status: 400 })
  }

  // O texto exibido precisa ser exatamente o que foi enviado.
  if (!c.texto || hashTexto(c.texto) !== c.hash_sha256)
    return NextResponse.json({ error: 'Falha de integridade do contrato. Fale com a MarmorarIA.' }, { status: 500 })

  const agora = new Date()
  const assinatura = {
    metodo: 'aceite eletrônico com código enviado por e-mail',
    nome,
    cpf,
    email: ct.email,
    ip: ipDaRequisicao(request),
    navegador: (request.headers.get('user-agent') ?? '').slice(0, 300),
    hash_sha256: c.hash_sha256,
    texto_aceite: TEXTO_ACEITE,
    assinado_em: agora.toISOString(),
    fuso: 'America/Sao_Paulo',
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from('contratos')
    .update({
      status: 'assinado',
      assinado_em: agora.toISOString(),
      assinatura,
      otp_hash: null,
      otp_expira_em: null,
      updated_at: agora.toISOString(),
    })
    .eq('id', c.id)
    .eq('status', 'enviado')
    .select('id')
    .maybeSingle()
  if (error || !atualizado) return NextResponse.json({ error: 'Não consegui registrar a assinatura. Tente de novo.' }, { status: 500 })

  // Cobrança da 1ª mensalidade/implantação. Se falhar, o contrato continua assinado.
  let linkPagamento: string | null = null
  try {
    const cob = await criarPrimeiraCobranca({
      nome: ct.razao_social,
      documento: ct.documento,
      email: ct.email,
      whatsapp: ct.whatsapp,
      valor: Number(c.primeira_cobranca),
      descricao: `MarmorarIA · ${PLANOS[c.plano as PlanoKey]?.nome ?? c.plano} · contrato ${c.numero}`,
      referencia: c.id,
    })
    if (cob) {
      linkPagamento = cob.invoiceUrl
      await supabaseAdmin
        .from('contratos')
        .update({ asaas_customer_id: cob.customerId, asaas_payment_id: cob.paymentId, link_pagamento: cob.invoiceUrl })
        .eq('id', c.id)
    }
  } catch (e) {
    console.error('[contratos] cobrança Asaas falhou', c.numero, e instanceof Error ? e.message : e)
  }

  const linkDoc = `${new URL(request.url).origin}/assinar/${token}/documento`
  await Promise.all([
    ct.email ? emailContratoAssinado(ct.email, c.numero, linkDoc, linkPagamento) : Promise.resolve(false),
    emailContratoAssinado(ALLOWED_ADMIN_EMAILS[0], c.numero, linkDoc, linkPagamento),
  ])

  // Lead do contrato vira cliente convertido.
  await supabaseAdmin.from('contratos').select('lead_id').eq('id', c.id).maybeSingle().then(async ({ data }) => {
    if (data?.lead_id) await supabaseAdmin.from('leads').update({ status: 'convertido', updated_at: agora.toISOString() }).eq('id', data.lead_id)
  })

  return NextResponse.json({ ok: true, documento: `/assinar/${token}/documento`, link_pagamento: linkPagamento })
}

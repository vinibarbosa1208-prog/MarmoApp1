import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { gerarTexto, VERSAO_MODELO } from '@/lib/contrato/modelo'
import { hashTexto } from '@/lib/contrato/hash'
import {
  colunasDoContrato,
  contratadaPadrao,
  contratadaPronta,
  dadosDaLinha,
  lerContratante,
  lerEntrada,
  pendenciasContratante,
  type LinhaContrato,
} from '@/lib/contrato/servidor'
import { novoToken } from '@/lib/contrato/seguranca'
import { emailLinkAssinatura } from '@/lib/contrato/email'

type Ctx = { params: Promise<{ id: string }> }

const CAMPOS =
  'id, numero, status, plano, condicao, mensalidade, implantacao, valor_por_medicao, fidelidade_meses, dia_vencimento, data_ativacao_antonio, mensalidade_ate_ativacao, primeira_cobranca, contratante, contratada, versao_modelo, texto, hash_sha256, token, enviado_em, assinado_em, assinatura, cancelado_em, motivo_cancelamento, link_pagamento, asaas_payment_id, lead_id, diagnostico_id, created_at'

async function carregar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabaseAdmin.from('contratos').select(CAMPOS).eq('id', id).maybeSingle()
  return data
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const c = await carregar(id)
  if (!c) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  // Rascunho: prévia com os dados atuais da MarmorarIA. Enviado: o texto congelado.
  const linha = { ...(c as unknown as LinhaContrato), contratada: c.status === 'rascunho' ? contratadaPadrao() : (c.contratada as LinhaContrato['contratada']) }
  const previa = c.status === 'rascunho' ? gerarTexto(dadosDaLinha(linha)) : c.texto
  const origem = new URL(request.url).origin
  return NextResponse.json({
    contrato: { ...c, otp_hash: undefined },
    previa,
    link: c.token ? `${origem}/assinar/${c.token}` : null,
    pendencias: c.status === 'rascunho' ? pendenciasContratante(linha.contratante) : [],
    contratada_pendente: c.status === 'rascunho' ? contratadaPronta(contratadaPadrao()) : null,
  })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const c = await carregar(id)
  if (!c) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  if (c.status !== 'rascunho') return NextResponse.json({ error: 'Só rascunhos podem ser editados.' }, { status: 409 })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const entrada = lerEntrada(b)
  if (typeof entrada === 'string') return NextResponse.json({ error: entrada }, { status: 400 })
  const contratante = lerContratante(b.contratante)

  const { error } = await supabaseAdmin
    .from('contratos')
    .update({ ...colunasDoContrato(entrada, contratante), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'rascunho')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const c = await carregar(id)
  if (!c) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  let b: Record<string, unknown> = {}
  try {
    b = await request.json()
  } catch {}
  const agora = new Date().toISOString()

  if (b.acao === 'cancelar') {
    if (c.status === 'assinado' || c.status === 'cancelado')
      return NextResponse.json({ error: 'Este contrato não pode mais ser cancelado por aqui.' }, { status: 409 })
    const { error } = await supabaseAdmin
      .from('contratos')
      .update({ status: 'cancelado', cancelado_em: agora, motivo_cancelamento: String(b.motivo ?? '').slice(0, 300) || null, token: null, updated_at: agora })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b.acao !== 'enviar') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  if (c.status !== 'rascunho') return NextResponse.json({ error: 'Este contrato já foi enviado.' }, { status: 409 })

  const contratada = contratadaPadrao()
  const faltaContratada = contratadaPronta(contratada)
  if (faltaContratada) return NextResponse.json({ error: faltaContratada }, { status: 400 })
  const pend = pendenciasContratante(c.contratante as LinhaContrato['contratante'])
  if (pend.length) return NextResponse.json({ error: `Falta preencher: ${pend.join(', ')}.` }, { status: 400 })

  // Congela o texto: daqui em diante ele não muda (garantido também no banco).
  const texto = gerarTexto(dadosDaLinha({ ...(c as unknown as LinhaContrato), contratada }))
  const token = novoToken()
  const { error } = await supabaseAdmin
    .from('contratos')
    .update({
      contratada,
      versao_modelo: VERSAO_MODELO,
      texto,
      hash_sha256: hashTexto(texto),
      token,
      status: 'enviado',
      enviado_em: agora,
      updated_at: agora,
    })
    .eq('id', id)
    .eq('status', 'rascunho')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const link = `${new URL(request.url).origin}/assinar/${token}`
  const ct = c.contratante as LinhaContrato['contratante']
  const emailOk = ct.email ? await emailLinkAssinatura(ct.email, ct.representante.split(' ')[0], c.numero, link) : false
  return NextResponse.json({ ok: true, link, email_enviado: emailOk })
}

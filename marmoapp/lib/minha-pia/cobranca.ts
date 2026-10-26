// Cobranças e baixas da Pia Programada (só servidor).
import { apiSupabase as supabase } from '@/lib/api-auth'
import { asaasConfigurado, asaasCriarCliente, asaasCriarCobrancaPix, asaasBuscarQr, asaasCancelarCobranca } from './asaas'
import { resumoAdesao, STATUS_PAGANDO, hojeSP, somarDias, ANTECIPACAO_MINIMA, type StatusAdesao } from './regras'
import { carregarConfig } from './servidor'

export type TipoCobranca = 'parcela' | 'antecipacao' | 'quitacao'

export const CAMPOS_ADESAO_SEGUROS =
  'id, marmoraria_id, numero, kit_id, cliente_id, kit_nome, valor_total, valor_parcela, dia_vencimento, nome, cpf, whatsapp, email, cep, endereco, numero_endereco, complemento, bairro, cidade, status, total_pago, desconto, quitada_em, medicao_data, instalacao_data, instalada_em, cancelada_em, antecipacao_solicitada_em, oferta_quitacao_valor, oferta_validade, oferta_mensagem, asaas_customer_id, utm_source, utm_medium, utm_campaign, created_at'

export interface AdesaoRow {
  id: string; marmoraria_id: string; numero: number; kit_id: string; cliente_id: string | null
  kit_nome: string; valor_total: number; valor_parcela: number; dia_vencimento: number
  nome: string; cpf: string; whatsapp: string; email: string | null
  cep: string | null; endereco: string | null; numero_endereco: string | null; complemento: string | null
  bairro: string | null; cidade: string
  status: StatusAdesao; total_pago: number; desconto: number; quitada_em: string | null
  medicao_data: string | null; instalacao_data: string | null; instalada_em: string | null; cancelada_em: string | null
  antecipacao_solicitada_em: string | null
  oferta_quitacao_valor: number | null; oferta_validade: string | null; oferta_mensagem: string | null
  asaas_customer_id: string | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  created_at: string
}

export async function carregarAdesao(id: string, marmoraria_id: string): Promise<AdesaoRow | null> {
  const { data, error } = await supabase
    .from('programado_adesoes').select(CAMPOS_ADESAO_SEGUROS)
    .eq('id', id).eq('marmoraria_id', marmoraria_id).maybeSingle()
  if (error) throw error
  return data as AdesaoRow | null
}

const CAMPOS_PAGAMENTO = 'id, tipo, valor, desconto_aplicado, vencimento, status, forma, pago_em, pix_copia_cola, pix_qr_base64, invoice_url, asaas_payment_id, created_at'

export class ErroCobranca extends Error {}

// Gera (ou reaproveita) a cobrança Pix que o cliente vai pagar agora.
export async function gerarCobranca(adesao: AdesaoRow, tipo: TipoCobranca, valorPedido?: number) {
  if (!STATUS_PAGANDO.includes(adesao.status)) throw new ErroCobranca('Este plano não aceita novos pagamentos.')
  const config = await carregarConfig(adesao.marmoraria_id)
  const r = resumoAdesao(adesao, config.prazo_entrega_dias)
  if (r.saldo <= 0) throw new ErroCobranca('Seu plano já está quitado.')

  let valor: number
  let desconto = 0
  if (tipo === 'parcela') valor = r.proximaParcelaValor
  else if (tipo === 'quitacao') { valor = r.valorQuitarHoje; desconto = Math.round((r.saldo - r.valorQuitarHoje) * 100) / 100 }
  else {
    valor = Math.round(Number(valorPedido) * 100) / 100
    if (!(valor >= ANTECIPACAO_MINIMA)) throw new ErroCobranca(`O valor mínimo para adiantar é R$ ${ANTECIPACAO_MINIMA}.`)
    if (valor >= r.saldo) { tipo = 'quitacao'; valor = r.valorQuitarHoje; desconto = Math.round((r.saldo - r.valorQuitarHoje) * 100) / 100 }
  }

  // Reaproveita uma cobrança igual que ainda está em aberto (evita Pix duplicado).
  const { data: aberta } = await supabase
    .from('programado_pagamentos').select(CAMPOS_PAGAMENTO)
    .eq('adesao_id', adesao.id).eq('status', 'pendente').eq('tipo', tipo).eq('valor', valor)
    .gte('created_at', new Date(Date.now() - 20 * 3600_000).toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (aberta) {
    if (aberta.asaas_payment_id && !aberta.pix_copia_cola) {
      try {
        const qr = await asaasBuscarQr(aberta.asaas_payment_id)
        await supabase.from('programado_pagamentos').update({ pix_copia_cola: qr.pixCopiaCola, pix_qr_base64: qr.pixQrBase64 }).eq('id', aberta.id)
        Object.assign(aberta, { pix_copia_cola: qr.pixCopiaCola, pix_qr_base64: qr.pixQrBase64 })
      } catch { /* tenta de novo na próxima abertura */ }
    }
    return aberta
  }

  // Outras cobranças em aberto deixam de valer (só uma por vez).
  await cancelarPendentes(adesao.id)

  const vencimento = somarDias(hojeSP(), 1)
  const descricao = `${config.nome_programa} #${adesao.numero} — ${
    tipo === 'parcela' ? `parcela ${r.parcelasPagas + 1}/${r.parcelasTotal}` : tipo === 'quitacao' ? 'quitação' : 'antecipação'
  } — ${adesao.kit_nome}`

  const linha: Record<string, unknown> = {
    marmoraria_id: adesao.marmoraria_id, adesao_id: adesao.id, tipo, valor,
    desconto_aplicado: desconto, vencimento, status: 'pendente', forma: 'manual',
  }

  if (asaasConfigurado()) {
    let customerId = adesao.asaas_customer_id
    if (!customerId) {
      customerId = await asaasCriarCliente({
        nome: adesao.nome, cpf: adesao.cpf, whatsapp: adesao.whatsapp, email: adesao.email, externalReference: adesao.id,
      })
      await supabase.from('programado_adesoes').update({ asaas_customer_id: customerId }).eq('id', adesao.id)
    }
    const c = await asaasCriarCobrancaPix({ customerId, valor, vencimento, descricao, externalReference: adesao.id })
    Object.assign(linha, {
      forma: 'pix', asaas_payment_id: c.id, invoice_url: c.invoiceUrl,
      pix_copia_cola: c.pixCopiaCola, pix_qr_base64: c.pixQrBase64,
    })
  }

  const { data, error } = await supabase.from('programado_pagamentos').insert(linha).select(CAMPOS_PAGAMENTO).single()
  if (error) throw error
  return data
}

export async function cancelarPendentes(adesaoId: string, exceto?: string) {
  let q = supabase.from('programado_pagamentos').select('id, asaas_payment_id').eq('adesao_id', adesaoId).eq('status', 'pendente')
  if (exceto) q = q.neq('id', exceto)
  const { data } = await q
  for (const p of data ?? []) {
    if (p.asaas_payment_id && asaasConfigurado()) {
      try { await asaasCancelarCobranca(p.asaas_payment_id) } catch { /* já paga/cancelada no Asaas */ }
    }
    await supabase.from('programado_pagamentos').update({ status: 'cancelado' }).eq('id', p.id)
  }
}

// Marca um pagamento como recebido e recalcula o plano. Idempotente.
export async function confirmarPagamento(pagamentoId: string, opts: { valorRecebido?: number; pagoEm?: string; forma?: string; registradoPor?: string | null } = {}) {
  const { data: pag, error } = await supabase
    .from('programado_pagamentos').select('id, adesao_id, status, valor').eq('id', pagamentoId).maybeSingle()
  if (error) throw error
  if (!pag) return null
  if (pag.status !== 'pago') {
    const upd: Record<string, unknown> = { status: 'pago', pago_em: opts.pagoEm || new Date().toISOString() }
    if (opts.valorRecebido && opts.valorRecebido > 0) upd.valor = opts.valorRecebido
    if (opts.forma) upd.forma = opts.forma
    if (opts.registradoPor) upd.registrado_por = opts.registradoPor
    const { error: e2 } = await supabase.from('programado_pagamentos').update(upd).eq('id', pag.id)
    if (e2) throw e2
  }
  const { data: adesao, error: e3 } = await supabase.rpc('programado_recalcular', { p_adesao_id: pag.adesao_id })
  if (e3) throw e3
  // Quitou: qualquer outro Pix em aberto deixa de valer.
  if (adesao && !STATUS_PAGANDO.includes(adesao.status)) await cancelarPendentes(pag.adesao_id, pag.id)
  return adesao
}

// Posição na fila de produção (por data de quitação).
export async function posicaoNaFila(adesao: AdesaoRow): Promise<number | null> {
  if (adesao.status !== 'quitada' || !adesao.quitada_em) return null
  const { count } = await supabase
    .from('programado_adesoes').select('id', { count: 'exact', head: true })
    .eq('marmoraria_id', adesao.marmoraria_id).eq('status', 'quitada').lt('quitada_em', adesao.quitada_em)
  return (count ?? 0) + 1
}

export { CAMPOS_PAGAMENTO }

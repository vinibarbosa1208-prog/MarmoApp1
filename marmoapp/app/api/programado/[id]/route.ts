import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { carregarAdesao, cancelarPendentes, CAMPOS_PAGAMENTO } from '@/lib/minha-pia/cobranca'
import { hashPin, errMsg } from '@/lib/minha-pia/servidor'
import { STATUS_PAGANDO, type StatusAdesao } from '@/lib/minha-pia/regras'

type Ctx = { params: Promise<{ id: string }> }

// GET — detalhe com todos os pagamentos.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { id } = await params
    const adesao = await carregarAdesao(id, marmoraria_id)
    if (!adesao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const { data: pagamentos } = await supabase.from('programado_pagamentos')
      .select(CAMPOS_PAGAMENTO + ', observacao').eq('adesao_id', id).order('created_at', { ascending: false })
    return NextResponse.json({ adesao, pagamentos: pagamentos ?? [] })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

// Avanços de etapa permitidos depois da quitação (o gestor só anda para frente,
// exceto voltar uma etapa para corrigir).
const ORDEM_OBRA: StatusAdesao[] = ['quitada', 'medicao_agendada', 'em_producao', 'instalacao_agendada', 'instalada']

// PATCH — { acao: 'status' | 'oferta' | 'novo_pin' | 'observacao', ... }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { id } = await params
    const adesao = await carregarAdesao(id, marmoraria_id)
    if (!adesao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const b = await req.json().catch(() => ({}))
    const upd: Record<string, unknown> = {}

    if (b.acao === 'status') {
      const novo = b.status as StatusAdesao
      const atualNaObra = ORDEM_OBRA.indexOf(adesao.status)
      const novoNaObra = ORDEM_OBRA.indexOf(novo)
      if (novoNaObra >= 0) {
        if (atualNaObra < 0) return NextResponse.json({ error: 'A pia só entra em produção depois de quitada.' }, { status: 400 })
        if (novoNaObra < atualNaObra - 1) return NextResponse.json({ error: 'Só é possível voltar uma etapa.' }, { status: 400 })
        if (novo === 'medicao_agendada') {
          if (!b.data) return NextResponse.json({ error: 'Informe a data da medição.' }, { status: 400 })
          upd.medicao_data = b.data
        }
        if (novo === 'instalacao_agendada') {
          if (!b.data) return NextResponse.json({ error: 'Informe a data da instalação.' }, { status: 400 })
          upd.instalacao_data = b.data
        }
        if (novo === 'instalada') upd.instalada_em = b.data ? new Date(b.data + 'T12:00:00-03:00').toISOString() : new Date().toISOString()
      } else if (novo === 'pausada' || novo === 'ativa') {
        if (!STATUS_PAGANDO.includes(adesao.status) || adesao.status === 'aguardando_pagamento') {
          return NextResponse.json({ error: 'Só dá para pausar/retomar um plano em pagamento.' }, { status: 400 })
        }
      } else if (novo === 'cancelada') {
        if (adesao.status === 'instalada') return NextResponse.json({ error: 'Plano já instalado.' }, { status: 400 })
        upd.cancelada_em = new Date().toISOString()
        await cancelarPendentes(id)
      } else {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
      }
      upd.status = novo
    } else if (b.acao === 'oferta') {
      if (b.valor == null || b.valor === '') {
        Object.assign(upd, { oferta_quitacao_valor: null, oferta_validade: null, oferta_mensagem: null })
      } else {
        const valor = Number(b.valor)
        const saldo = Number(adesao.valor_total) - Number(adesao.total_pago) - Number(adesao.desconto)
        if (!(valor > 0) || valor >= saldo) return NextResponse.json({ error: 'A oferta precisa ser menor que o saldo.' }, { status: 400 })
        Object.assign(upd, {
          oferta_quitacao_valor: valor,
          oferta_validade: b.validade || null,
          oferta_mensagem: typeof b.mensagem === 'string' ? b.mensagem.slice(0, 200) || null : null,
        })
      }
    } else if (b.acao === 'novo_pin') {
      let pin = ''
      do { pin = String(randomInt(0, 10000)).padStart(4, '0') } while (/^(\d)\1{3}$/.test(pin) || pin === '1234')
      upd.pin_hash = await hashPin(pin)
      upd.pin_tentativas = 0
      upd.pin_bloqueado_ate = null
      const { error } = await supabase.from('programado_adesoes').update(upd).eq('id', id)
      if (error) throw error
      await supabase.from('programado_sessoes').delete().eq('adesao_id', id)
      return NextResponse.json({ ok: true, pin })
    } else if (b.acao === 'observacao') {
      upd.observacao_interna = typeof b.texto === 'string' ? b.texto.slice(0, 2000) : null
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const { error } = await supabase.from('programado_adesoes').update(upd).eq('id', id).eq('marmoraria_id', marmoraria_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { adesaoDaSessao, getProgramadoMarmorariaId, carregarConfig, errMsg } from '@/lib/minha-pia/servidor'
import { carregarAdesao, posicaoNaFila, CAMPOS_PAGAMENTO } from '@/lib/minha-pia/cobranca'
import { resumoAdesao, STATUS_PAGANDO } from '@/lib/minha-pia/regras'
import { asaasConfigurado } from '@/lib/minha-pia/asaas'

// GET — tudo que o cliente logado vê no painel.
export async function GET() {
  try {
    const adesaoId = await adesaoDaSessao()
    if (!adesaoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const marmoraria_id = getProgramadoMarmorariaId()
    const adesao = await carregarAdesao(adesaoId, marmoraria_id)
    if (!adesao) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

    const [config, { data: kit }, { data: pagamentos }, { data: marm }, posicao] = await Promise.all([
      carregarConfig(marmoraria_id),
      supabase.from('programado_kits').select('codigo, material_nome, tom, grupo, comprimento_m, inclui, custo_base').eq('id', adesao.kit_id).maybeSingle(),
      supabase.from('programado_pagamentos').select(CAMPOS_PAGAMENTO).eq('adesao_id', adesao.id)
        .in('status', ['pago', 'pendente']).order('created_at', { ascending: false }),
      supabase.from('marmorarias').select('nome').eq('id', marmoraria_id).maybeSingle(),
      posicaoNaFila(adesao),
    ])

    const resumo = resumoAdesao(adesao, config.prazo_entrega_dias)
    const pagando = STATUS_PAGANDO.includes(adesao.status)
    const aberta = pagando ? (pagamentos ?? []).find(p => p.status === 'pendente') ?? null : null
    const custoBase = Number(kit?.custo_base ?? 0)

    return NextResponse.json({
      marmoraria: marm?.nome ?? '',
      config: {
        nome_programa: config.nome_programa,
        whatsapp_contato: config.whatsapp_contato,
        prazo_entrega_dias: config.prazo_entrega_dias,
        modo_pagamento: asaasConfigurado() ? 'asaas' : 'manual',
        pix_chave: asaasConfigurado() ? null : config.pix_chave,
        pix_favorecido: asaasConfigurado() ? null : config.pix_favorecido,
      },
      adesao: {
        numero: adesao.numero,
        primeiro_nome: adesao.nome.split(' ')[0],
        kit_nome: adesao.kit_nome,
        valor_total: Number(adesao.valor_total),
        valor_parcela: Number(adesao.valor_parcela),
        dia_vencimento: adesao.dia_vencimento,
        status: adesao.status,
        bairro: adesao.bairro,
        cidade: adesao.cidade,
        created_at: adesao.created_at,
        quitada_em: adesao.quitada_em,
        medicao_data: adesao.medicao_data,
        instalacao_data: adesao.instalacao_data,
        instalada_em: adesao.instalada_em,
        antecipacao_solicitada_em: adesao.antecipacao_solicitada_em,
        oferta_mensagem: resumo.ofertaAtiva ? adesao.oferta_mensagem : null,
        oferta_validade: resumo.ofertaAtiva ? adesao.oferta_validade : null,
      },
      kit: kit ? { codigo: kit.codigo, material_nome: kit.material_nome, tom: kit.tom, grupo: kit.grupo, comprimento_m: Number(kit.comprimento_m), inclui: kit.inclui } : null,
      resumo,
      // Ao cobrir o custo da pia, o cliente pode pedir para antecipar a instalação.
      antecipacao_disponivel: pagando && resumo.saldo > 0 && custoBase > 0 && Number(adesao.total_pago) >= custoBase,
      posicao_fila: posicao,
      cobranca_aberta: aberta,
      pagamentos: (pagamentos ?? []).filter(p => p.status === 'pago').map(p => ({
        id: p.id, tipo: p.tipo, valor: Number(p.valor), desconto_aplicado: Number(p.desconto_aplicado), pago_em: p.pago_em, forma: p.forma,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[minha-pia/painel]', errMsg(e))
    return NextResponse.json({ error: 'Erro ao carregar seu plano' }, { status: 500 })
  }
}

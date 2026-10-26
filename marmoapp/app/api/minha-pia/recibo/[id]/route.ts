import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { adesaoDaSessao, getProgramadoMarmorariaId, carregarConfig, errMsg } from '@/lib/minha-pia/servidor'
import { carregarAdesao } from '@/lib/minha-pia/cobranca'

// GET — dados do recibo de um pagamento confirmado (só do plano logado).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adesaoId = await adesaoDaSessao()
    if (!adesaoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const { id } = await params
    const marmoraria_id = getProgramadoMarmorariaId()
    const [adesao, { data: pag }, { data: marm }, config] = await Promise.all([
      carregarAdesao(adesaoId, marmoraria_id),
      supabase.from('programado_pagamentos').select('id, tipo, valor, desconto_aplicado, forma, pago_em, status, created_at')
        .eq('id', id).eq('adesao_id', adesaoId).eq('status', 'pago').maybeSingle(),
      supabase.from('marmorarias').select('nome, cnpj, endereco, cidade, estado, telefone').eq('id', marmoraria_id).maybeSingle(),
      carregarConfig(marmoraria_id),
    ])
    if (!adesao || !pag) return NextResponse.json({ error: 'Recibo não encontrado' }, { status: 404 })

    // Total pago até este pagamento (inclusive), para constar no recibo.
    const { data: anteriores } = await supabase.from('programado_pagamentos').select('valor, desconto_aplicado, pago_em')
      .eq('adesao_id', adesaoId).eq('status', 'pago').lte('pago_em', pag.pago_em)
    const acumulado = (anteriores ?? []).reduce((s, p) => s + Number(p.valor) + Number(p.desconto_aplicado), 0)

    return NextResponse.json({
      codigo: pag.id.slice(0, 8).toUpperCase(),
      pagamento: { tipo: pag.tipo, valor: Number(pag.valor), desconto: Number(pag.desconto_aplicado), forma: pag.forma, pago_em: pag.pago_em },
      plano: { numero: adesao.numero, kit_nome: adesao.kit_nome, valor_total: Number(adesao.valor_total), acumulado: Math.min(acumulado, Number(adesao.valor_total)) },
      cliente: { nome: adesao.nome, cpf_final: `${adesao.cpf.slice(6, 9)}-${adesao.cpf.slice(9)}` },
      loja: {
        nome: marm?.nome ?? '', cnpj: config.cnpj || marm?.cnpj || null,
        endereco: marm?.endereco ? `${marm.endereco}, ${marm.cidade}–${marm.estado}` : null, telefone: marm?.telefone ?? null,
      },
      programa: config.nome_programa,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

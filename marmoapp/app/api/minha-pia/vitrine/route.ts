import { NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getProgramadoMarmorariaId, carregarConfig, errMsg } from '@/lib/minha-pia/servidor'
import { opcoesParcela } from '@/lib/minha-pia/regras'

// GET público — o que a página do anúncio precisa: kits, parcelas,
// cidades atendidas e prazo médio de entrega atual.
// Nunca devolve custo_base (é custo interno).
export async function GET() {
  try {
    const marmoraria_id = getProgramadoMarmorariaId()
    const [config, { data: kits, error }, { data: marm }, { data: entregues }, { count: naFila }] = await Promise.all([
      carregarConfig(marmoraria_id),
      supabase.from('programado_kits')
        .select('codigo, nome, grupo, material_nome, tom, comprimento_m, descricao, inclui, preco_total')
        .eq('marmoraria_id', marmoraria_id).eq('ativo', true).order('ordem'),
      supabase.from('marmorarias').select('nome, cidade').eq('id', marmoraria_id).maybeSingle(),
      supabase.from('programado_adesoes').select('quitada_em, instalada_em')
        .eq('marmoraria_id', marmoraria_id).eq('status', 'instalada').not('quitada_em', 'is', null)
        .order('instalada_em', { ascending: false }).limit(20),
      supabase.from('programado_adesoes').select('id', { count: 'exact', head: true })
        .eq('marmoraria_id', marmoraria_id).in('status', ['quitada', 'medicao_agendada', 'em_producao', 'instalacao_agendada']),
    ])
    if (error) throw error

    // Prazo médio real (quitação → instalação) quando já houver histórico;
    // antes disso vale o prazo configurado.
    let prazoMedio = config.prazo_entrega_dias
    const amostras = (entregues ?? []).filter(e => e.instalada_em && e.quitada_em)
      .map(e => (new Date(e.instalada_em!).getTime() - new Date(e.quitada_em!).getTime()) / 86400_000)
    if (amostras.length >= 3) prazoMedio = Math.max(1, Math.round(amostras.reduce((s, d) => s + d, 0) / amostras.length))

    return NextResponse.json({
      ativo: config.ativo,
      nome_programa: config.nome_programa,
      marmoraria: marm?.nome ?? '',
      cidade_base: marm?.cidade ?? 'Arujá',
      prazo_entrega_dias: prazoMedio,
      prazo_baseado_em_entregas: amostras.length >= 3,
      pias_na_fila: naFila ?? 0,
      cidades_atendidas: config.cidades_atendidas,
      whatsapp_contato: config.whatsapp_contato,
      kits: (kits ?? []).map(k => ({
        ...k,
        preco_total: Number(k.preco_total),
        comprimento_m: Number(k.comprimento_m),
        parcelas: opcoesParcela(Number(k.preco_total), config.parcelas_opcoes),
      })),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

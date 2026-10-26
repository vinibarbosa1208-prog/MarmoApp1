import { NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { adesaoDaSessao, getProgramadoMarmorariaId, errMsg } from '@/lib/minha-pia/servidor'
import { carregarAdesao } from '@/lib/minha-pia/cobranca'
import { STATUS_PAGANDO } from '@/lib/minha-pia/regras'

// POST — cliente que já cobriu o custo da pia pede para antecipar a
// instalação. Só registra o pedido; quem decide a oferta é o gestor.
export async function POST() {
  try {
    const adesaoId = await adesaoDaSessao()
    if (!adesaoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const adesao = await carregarAdesao(adesaoId, getProgramadoMarmorariaId())
    if (!adesao || !STATUS_PAGANDO.includes(adesao.status)) return NextResponse.json({ error: 'Plano não disponível para antecipação' }, { status: 400 })

    const { data: kit } = await supabase.from('programado_kits').select('custo_base').eq('id', adesao.kit_id).maybeSingle()
    if (!kit || Number(adesao.total_pago) < Number(kit.custo_base)) {
      return NextResponse.json({ error: 'A antecipação ainda não está liberada para o seu plano.' }, { status: 400 })
    }
    if (!adesao.antecipacao_solicitada_em) {
      await supabase.from('programado_adesoes').update({ antecipacao_solicitada_em: new Date().toISOString() }).eq('id', adesao.id)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

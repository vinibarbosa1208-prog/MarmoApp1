import { NextRequest, NextResponse } from 'next/server'
import { adesaoDaSessao, getProgramadoMarmorariaId, errMsg } from '@/lib/minha-pia/servidor'
import { carregarAdesao, gerarCobranca, ErroCobranca, type TipoCobranca } from '@/lib/minha-pia/cobranca'

// POST { tipo: 'parcela' | 'antecipacao' | 'quitacao', valor? } → Pix para pagar agora.
export async function POST(req: NextRequest) {
  try {
    const adesaoId = await adesaoDaSessao()
    if (!adesaoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const b = await req.json().catch(() => ({}))
    const tipo = b.tipo as TipoCobranca
    if (!['parcela', 'antecipacao', 'quitacao'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    const adesao = await carregarAdesao(adesaoId, getProgramadoMarmorariaId())
    if (!adesao) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

    const cobranca = await gerarCobranca(adesao, tipo, b.valor)
    return NextResponse.json(cobranca)
  } catch (e) {
    if (e instanceof ErroCobranca) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[minha-pia/cobranca]', errMsg(e))
    return NextResponse.json({ error: 'Não foi possível gerar o Pix agora. Tente de novo em instantes.' }, { status: 502 })
  }
}

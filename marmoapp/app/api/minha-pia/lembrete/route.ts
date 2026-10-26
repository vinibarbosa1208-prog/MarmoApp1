import { NextResponse } from 'next/server'
import { adesaoDaSessao, getProgramadoMarmorariaId, carregarConfig, errMsg } from '@/lib/minha-pia/servidor'
import { carregarAdesao } from '@/lib/minha-pia/cobranca'
import { resumoAdesao, STATUS_PAGANDO } from '@/lib/minha-pia/regras'

// GET — arquivo de agenda (.ics) com um lembrete por mês no dia do
// vencimento, até a última parcela. Funciona na agenda do Android e do iPhone.
export async function GET() {
  try {
    const adesaoId = await adesaoDaSessao()
    if (!adesaoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const marmoraria_id = getProgramadoMarmorariaId()
    const adesao = await carregarAdesao(adesaoId, marmoraria_id)
    if (!adesao || !STATUS_PAGANDO.includes(adesao.status)) return NextResponse.json({ error: 'Plano sem parcelas em aberto' }, { status: 400 })
    const config = await carregarConfig(marmoraria_id)
    const r = resumoAdesao(adesao, config.prazo_entrega_dias)
    if (!r.proximaParcelaVencimento) return NextResponse.json({ error: 'Plano sem parcelas em aberto' }, { status: 400 })

    const faltam = Math.max(1, Math.ceil(r.saldo / Number(adesao.valor_parcela)))
    const inicio = r.proximaParcelaVencimento.replace(/-/g, '')
    const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.marmoapp.com'
    const valor = Number(adesao.valor_parcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const esc = (t: string) => t.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n')

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MarmoApp//Pia Programada//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:pia-programada-${adesao.id}@marmoapp.com`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${adesao.dia_vencimento};COUNT=${faltam}`,
      `SUMMARY:${esc(`Parcela da minha pia (R$ ${valor})`)}`,
      `DESCRIPTION:${esc(`${config.nome_programa}, plano #${adesao.numero}. Pague pelo Pix no seu painel: ${base}/minha-pia/painel`)}`,
      `URL:${base}/minha-pia/painel`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15H', `DESCRIPTION:${esc('Amanhã vence a parcela da sua pia')}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lembrete-pia-programada.ics"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

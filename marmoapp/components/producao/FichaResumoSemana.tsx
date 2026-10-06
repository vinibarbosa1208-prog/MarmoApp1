'use client'

import { mlEquivalente } from '@/lib/capacidade'
import { fmt as fmtMoeda } from '@/lib/utils'
import { fmtNum, type LinhaFicha } from '@/lib/producao/ficha-client'

// Resumo da semana (cards no rodapé): ml acabados (reto e ME separados),
// m² cortados, custo por ml acabado na semana, instalação a receber.
//
// Presença entra só pro custo por ml — diária do dia ÷ ml eq. do dia, em
// média ponderada. Dia misto (acabamento + instalação no mesmo dia) conta
// a diária inteira como custo de acabamento (decisão da spec, revisar
// depois de 4 semanas de dados reais).

export default function FichaResumoSemana({
  linhas, fatorME, presencasPorDia,
}: {
  linhas: LinhaFicha[]
  fatorME: number
  /** diária do dia, só dos dias em que a pessoa esteve presente */
  presencasPorDia: Map<string, number>
}) {
  const acabamento = linhas.filter(l => l.etapa === 'acabamento')
  const mlReto = acabamento.filter(l => l.tipo_acabamento !== 'meia_esquadria').reduce((s, l) => s + l.quantidade, 0)
  const mlME = acabamento.filter(l => l.tipo_acabamento === 'meia_esquadria').reduce((s, l) => s + l.quantidade, 0)

  const m2Corte = linhas.filter(l => l.etapa === 'corte').reduce((s, l) => s + l.quantidade, 0)

  const instalacao = linhas.filter(l => l.etapa === 'instalacao')
  const valorInstalacao = instalacao.reduce((s, l) => s + (l.valor_calculado ?? 0), 0)
  const pendenteAprovacao = instalacao.some(l => l.status === 'pendente')

  // Custo por ml: só os dias que têm diária E ml de acabamento lançado.
  const mlEqPorDia = new Map<string, number>()
  for (const l of acabamento) {
    mlEqPorDia.set(l.data, (mlEqPorDia.get(l.data) ?? 0) + mlEquivalente([{ quantidade: l.quantidade, tipo_acabamento: l.tipo_acabamento }], fatorME))
  }
  let custoTotal = 0
  let mlTotal = 0
  for (const [dia, ml] of mlEqPorDia) {
    const diaria = presencasPorDia.get(dia)
    if (!diaria || ml <= 0) continue
    custoTotal += diaria
    mlTotal += ml
  }
  const custoPorMl = mlTotal > 0 ? custoTotal / mlTotal : null

  const cards: { label: string; valor: string; cor?: string }[] = [
    { label: 'ML acabado — reto', valor: `${fmtNum(mlReto)} ml` },
    { label: 'ML acabado — meia esquadria', valor: `${fmtNum(mlME)} ml` },
    { label: 'M² cortado', valor: `${fmtNum(m2Corte)} m²` },
    { label: 'Custo por ml acabado (semana)', valor: custoPorMl !== null ? `${fmtMoeda(custoPorMl)}/ml` : '—' },
    { label: 'Instalação a receber', valor: fmtMoeda(valorInstalacao), cor: pendenteAprovacao ? '#B9770E' : 'var(--green)' },
  ]

  return (
    <div className="stats-grid" style={{ marginTop: 20 }}>
      {cards.map(c => (
        <div className="stat-card" key={c.label}>
          <div className="stat-info">
            <div className="stat-value" style={c.cor ? { color: c.cor } : undefined}>{c.valor}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

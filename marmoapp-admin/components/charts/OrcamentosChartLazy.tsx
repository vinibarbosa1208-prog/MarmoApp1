'use client'

import dynamic from 'next/dynamic'
import type { OrcamentosPorDia } from '@/lib/types'

const OrcamentosChart = dynamic(() => import('./OrcamentosChart'), {
  ssr: false,
  loading: () => (
    <div className="h-60 flex items-center justify-center text-slate-500 text-sm">
      Carregando gráfico...
    </div>
  ),
})

export default function OrcamentosChartLazy({ data }: { data: OrcamentosPorDia[] }) {
  return <OrcamentosChart data={data} />
}

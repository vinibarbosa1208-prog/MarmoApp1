'use client'

import dynamic from 'next/dynamic'

interface PlanData {
  name: string
  value: number
}

const PlanDonutChart = dynamic(() => import('./PlanDonutChart'), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
      Carregando gráfico...
    </div>
  ),
})

export default function PlanDonutChartLazy({ data }: { data: PlanData[] }) {
  return <PlanDonutChart data={data} />
}

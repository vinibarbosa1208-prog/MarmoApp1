'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { OrcamentosPorDia } from '@/lib/types'

interface OrcamentosChartProps {
  data: OrcamentosPorDia[]
}

export default function OrcamentosChart({ data }: OrcamentosChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="data"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#818cf8' }}
        />
        <Bar dataKey="total" name="Orçamentos" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

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
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="data"
          tick={{ fill: '#6B7280', fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #E5E7EB', borderRadius: 8 }}
          labelStyle={{ color: '#6B7280' }}
          itemStyle={{ color: '#8A6D1F' }}
        />
        <Bar dataKey="total" name="Orçamentos" fill="#C9A84C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

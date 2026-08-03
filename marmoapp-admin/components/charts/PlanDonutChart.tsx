'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PlanData {
  name: string
  value: number
}

interface PlanDonutChartProps {
  data: PlanData[]
}

const COLORS = ['#eab308', '#3b82f6', '#a855f7', '#10b981']

export default function PlanDonutChart({ data }: PlanDonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

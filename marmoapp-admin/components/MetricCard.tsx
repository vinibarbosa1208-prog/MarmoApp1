interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  accent?: 'green' | 'blue' | 'yellow' | 'purple' | 'default'
}

const accentMap = {
  green: 'text-emerald-400',
  blue: 'text-blue-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
  default: 'text-white',
}

export default function MetricCard({
  title,
  value,
  subtitle,
  accent = 'default',
}: MetricCardProps) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${accentMap[accent]}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

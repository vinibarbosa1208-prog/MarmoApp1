interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  accent?: 'green' | 'blue' | 'yellow' | 'purple' | 'gold' | 'red' | 'default'
}

const accentMap = {
  green: 'text-emerald-700',
  blue: 'text-blue-700',
  yellow: 'text-yellow-700',
  purple: 'text-purple-700',
  gold: 'text-gold-dk',
  red: 'text-red-700',
  default: 'text-gray-900',
}

export default function MetricCard({
  title,
  value,
  subtitle,
  accent = 'default',
}: MetricCardProps) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <p className={`mt-2 font-serif text-[28px] font-bold leading-tight ${accentMap[accent]}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  )
}

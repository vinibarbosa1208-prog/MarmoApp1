interface StatusBadgeProps {
  value: string | null
  type?: 'plano' | 'status'
}

const planoColors: Record<string, string> = {
  trial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  basic: 'bg-blue-50 text-blue-700 border-blue-200',
  pro: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  canceled: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-red-50 text-red-700 border-red-200',
  past_due: 'bg-orange-50 text-orange-700 border-orange-200',
  trial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

export default function StatusBadge({ value, type = 'plano' }: StatusBadgeProps) {
  if (!value) return <span className="text-gray-400 text-xs">—</span>
  const map = type === 'plano' ? planoColors : statusColors
  const cls = map[value.toLowerCase()] ?? 'bg-gray-100 text-gray-700 border-gray-300'
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}

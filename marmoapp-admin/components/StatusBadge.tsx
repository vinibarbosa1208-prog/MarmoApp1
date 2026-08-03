interface StatusBadgeProps {
  value: string | null
  type?: 'plano' | 'status'
}

const planoColors: Record<string, string> = {
  trial: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  basic: 'bg-blue-900 text-blue-300 border-blue-700',
  pro: 'bg-purple-900 text-purple-300 border-purple-700',
  enterprise: 'bg-emerald-900 text-emerald-300 border-emerald-700',
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-900 text-emerald-300 border-emerald-700',
  ativo: 'bg-emerald-900 text-emerald-300 border-emerald-700',
  canceled: 'bg-red-900 text-red-300 border-red-700',
  cancelado: 'bg-red-900 text-red-300 border-red-700',
  past_due: 'bg-orange-900 text-orange-300 border-orange-700',
  trial: 'bg-yellow-900 text-yellow-300 border-yellow-700',
}

export default function StatusBadge({ value, type = 'plano' }: StatusBadgeProps) {
  if (!value) return <span className="text-slate-600 text-xs">—</span>
  const map = type === 'plano' ? planoColors : statusColors
  const cls = map[value.toLowerCase()] ?? 'bg-slate-700 text-slate-300 border-slate-600'
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}

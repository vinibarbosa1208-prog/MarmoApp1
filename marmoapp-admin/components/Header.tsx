import LogoutButton from './LogoutButton'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        <LogoutButton />
      </div>
    </header>
  )
}

import LogoutButton from './LogoutButton'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

// Barra superior branca, título em Playfair, como no sistema MarmoApp.
export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-2">
      <div className="min-w-0">
        <h1 className="font-serif text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action}
        <LogoutButton />
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬛' },
  { href: '/clientes', label: 'Clientes', icon: '🏢' },
  { href: '/assinaturas', label: 'Assinaturas', icon: '💳' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/erros', label: 'Erros', icon: '🔴' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-slate-900 border-r border-slate-800">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-indigo-400">Marmo</span>
          <span className="text-white">App</span>
          <span className="ml-1.5 text-xs font-normal text-slate-500">admin</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <p className="px-3 text-xs text-slate-600">MarmoApp © 2026</p>
      </div>
    </aside>
  )
}

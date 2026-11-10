'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Mesmo visual da barra lateral do sistema MarmoApp: fundo #1E1E2E,
// item ativo com fundo dourado translúcido e borda dourada à esquerda.

const i = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

const SECOES: { label: string; itens: { href: string; label: string; icon: React.ReactNode; externo?: boolean }[] }[] = [
  {
    label: 'Principal',
    itens: [
      { href: '/dashboard', label: 'Dashboard', icon: i(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>) },
      { href: '/clientes', label: 'Clientes', icon: i(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
    ],
  },
  {
    label: 'Comercial',
    itens: [
      { href: '/apresentacao', label: 'Apresentação de diagnóstico', externo: true, icon: i(<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>) },
      { href: '/contratos', label: 'Contratos', icon: i(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" /></>) },
      { href: '/marketing', label: 'Marketing', icon: i(<><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>) },
    ],
  },
  {
    label: 'Financeiro',
    itens: [
      { href: '/financeiro', label: 'Financeiro', icon: i(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10v4M18 10v4" /></>) },
      { href: '/pagamentos', label: 'Pagamentos de clientes', icon: i(<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>) },
    ],
  },
  {
    label: 'Sistema',
    itens: [
      { href: '/erros', label: 'Erros', icon: i(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>) },
      { href: '/configuracoes', label: 'Configurações', icon: i(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>) },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/5 bg-sidebar">
      <div className="border-b border-white/5 px-4 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-marmoapp.jpg" alt="MarmoApp" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight tracking-tight text-white/90">MarmoApp</div>
            <div className="mt-0.5 truncate text-[10.5px] text-white/35">Painel central · time interno</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-3 pt-2">
        {SECOES.map((s) => (
          <div key={s.label}>
            <div className="px-4 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[1px] text-white/30">{s.label}</div>
            {s.itens.map((item) => {
              const ativo = !item.externo && (pathname === item.href || pathname.startsWith(item.href + '/'))
              const cls = `my-px flex items-center gap-2.5 border-l-2 px-4 py-2 text-[13px] transition-all ${
                ativo
                  ? 'border-gold bg-[rgba(201,168,76,0.15)] font-semibold text-gold [&_svg]:opacity-100'
                  : 'border-transparent text-white/55 hover:bg-white/5 hover:text-white/85 [&_svg]:opacity-65'
              }`
              return item.externo ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener" className={cls}>
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={cls}>
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 bg-black/20 px-4 py-3">
        <p className="text-[10.5px] text-white/30">Marmoapp Tecnologia LTDA · {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}

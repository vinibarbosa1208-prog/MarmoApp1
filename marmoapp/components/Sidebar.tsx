'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

const NAV = [
  {
    label: 'Dashboard', href: '/dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    label: 'Orçamentos', href: '/orcamentos',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
  {
    label: 'Clientes', href: '/clientes',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: 'Agenda', href: '/agenda',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    label: 'Projetos', href: '/projetos',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="3 20 21 20"/></svg>,
  },
  {
    label: 'Fila de Serviços', href: '/fila',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  },
  {
    label: 'Estoque', href: '/estoque',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  },
  {
    label: 'Relatórios', href: '/relatorios',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    label: 'Preços e Serviços', href: '/precos',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M4.93 4.93l1.41 1.41M18.66 18.66l1.41 1.41M2 12h2M20 12h2M12 2v2M12 20v2"/></svg>,
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { marmoraria, user } = useApp()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
            <span style={{ color: 'var(--dark)' }}>marmo</span><span style={{ color: 'var(--gold)' }}>app</span>
          </div>
        </div>
        <small id="company-name-sidebar">{marmoraria?.nome || 'Marmoraria'}</small>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        {marmoraria?.plano === 'enterprise' && (
          <Link
            href="/antonio"
            className={`nav-item${isActive('/antonio') ? ' active' : ''}`}
            style={{ borderTop: '1px solid #eee', marginTop: 8, paddingTop: 16 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Agente Antônio
            <span style={{ fontSize: 9, background: 'var(--gold)', color: '#000', padding: '2px 5px', borderRadius: 4, fontWeight: 700, marginLeft: 4 }}>ENTERPRISE</span>
          </Link>
        )}
      </nav>

      <div className="sidebar-user">
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--dark)' }}>{marmoraria?.nome || 'Minha Empresa'}</div>
        <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>{user?.email}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Link href="/precos" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Configurações</Link>
          <span style={{ color: 'var(--gray2)' }}>·</span>
          <button
            onClick={async () => {
              const { supabase } = await import('@/lib/supabase')
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            style={{ fontSize: 11, color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}

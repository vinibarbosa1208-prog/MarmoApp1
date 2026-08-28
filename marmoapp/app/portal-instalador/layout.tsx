'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase'

// Portal restrito do instalador — layout próprio, sem o menu/sidebar do app
// completo. Só usuários com perfil='instalador' entram aqui; qualquer outro
// perfil é mandado de volta pro dashboard normal.
export default function PortalInstaladorLayout({ children }: { children: React.ReactNode }) {
  const { user, perfil, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (perfil !== null && perfil !== 'instalador') { router.replace('/dashboard'); return }
  }, [user, perfil, loading, router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading || !user || (perfil !== null && perfil !== 'instalador')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)' }}>
        Carregando…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'var(--dark)', color: '#fff',
      }}>
        <img src="/logo-marmoapp.jpg" alt="MarmoApp" style={{ height: 26, objectFit: 'contain' }} />
        <button
          onClick={sair}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          Sair
        </button>
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {children}
      </main>
    </div>
  )
}

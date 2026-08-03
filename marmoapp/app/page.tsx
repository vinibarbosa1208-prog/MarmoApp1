'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

export default function RootPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/dashboard')
    } else {
      // Visitante sem sessão: manda pra landing page oficial, não pro cadastro direto
      window.location.href = 'https://marmoapp.com'
    }
  }, [loading, user, router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#1A1A2E',
    }}>
      <img src="/logo-marmoapp.jpg" alt="MarmoApp" style={{ width: 48, height: 48, borderRadius: 10, opacity: 0.8 }} />
    </div>
  )
}

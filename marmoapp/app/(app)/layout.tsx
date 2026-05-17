'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Toast from '@/components/Toast'
import { useApp } from '@/contexts/AppContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useApp()
  const router = useRouter()

  useEffect(() => {
    // Give context a moment to hydrate from supabase session
    const t = setTimeout(() => {
      if (user === null) router.push('/login')
    }, 800)
    return () => clearTimeout(t)
  }, [user, router])

  return (
    <>
      <Sidebar />
      <div className="main">
        <div id="page-content">
          {children}
        </div>
      </div>
      <Toast />
    </>
  )
}

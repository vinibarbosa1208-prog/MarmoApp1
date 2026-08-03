'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
    >
      Sair
    </button>
  )
}

'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  marmorariaId: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  marmorariaId: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [marmorariaId, setMarmorariaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Buscar sessão UMA vez no mount (getSession é local — não faz network call)
    const initAuth = async () => {
      if (fetchedRef.current) return
      fetchedRef.current = true

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase
          .from('usuarios')
          .select('marmoraria_id')
          .eq('id', session.user.id)
          .single()
        setMarmorariaId(data?.marmoraria_id ?? null)
      }
      setLoading(false)
    }

    initAuth()

    // Ouvir mudanças de sessão (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Token refresh não muda marmoraria — evitar re-fetch desnecessário
        if (event === 'TOKEN_REFRESHED') return
        // INITIAL_SESSION já tratado por initAuth acima
        if (event === 'INITIAL_SESSION') return

        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase
            .from('usuarios')
            .select('marmoraria_id')
            .eq('id', session.user.id)
            .single()
          setMarmorariaId(data?.marmoraria_id ?? null)
        } else {
          setMarmorariaId(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, marmorariaId, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

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

async function fetchMarmorariaId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', userId)
    .single()
  if (!error) return data?.marmoraria_id ?? null

  console.error('[AuthContext] Erro ao buscar marmoraria_id, tentando novamente em 1s:', error)
  await new Promise(r => setTimeout(r, 1000))
  const retry = await supabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', userId)
    .single()
  if (retry.error) {
    console.error('[AuthContext] Erro ao buscar marmoraria_id (retry falhou):', retry.error)
    return null
  }
  return retry.data?.marmoraria_id ?? null
}

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
        setMarmorariaId(await fetchMarmorariaId(session.user.id))
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
          setMarmorariaId(await fetchMarmorariaId(session.user.id))
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

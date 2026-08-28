'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  marmorariaId: string | null
  perfil: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  marmorariaId: null,
  perfil: null,
  loading: true,
})

// Nunca deixa uma chamada ao Supabase travar o loading pra sempre
// (sessão corrompida/token de refresh inválido no localStorage de uma máquina
// específica podia deixar getSession() pendurado e a tela presa em "carregando")
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[AuthContext] Timeout em ${label} (${ms}ms)`)), ms)
    ),
  ])
}

type UsuarioInfo = { marmoraria_id: string | null; perfil: string | null }

// Retorno tem 3 estados possíveis, e a diferença importa:
//  - objeto  → usuário encontrado (marmoraria_id e/ou perfil podem ser null)
//  - null    → confirmado: esse usuário realmente não tem registro em usuarios
//  - undefined → NÃO foi possível confirmar (falha pontual de rede/RLS/timing).
//    Isso NÃO é a mesma coisa que "sem marmoraria" — quem chamar essa função
//    não deve tratar undefined como null, senão um usuário válido pode ser
//    expulso para /cadastro por causa de uma falha transitória.
async function fetchUsuarioInfo(userId: string): Promise<UsuarioInfo | null | undefined> {
  try {
    const { data, error } = await withTimeout(
      supabase.from('usuarios').select('marmoraria_id, perfil').eq('id', userId).single(),
      8000,
      'fetchUsuarioInfo'
    )
    if (!error) return data ? { marmoraria_id: data.marmoraria_id ?? null, perfil: data.perfil ?? null } : null

    console.error('[AuthContext] Erro ao buscar usuarios, tentando novamente em 1s:', error)
    await new Promise(r => setTimeout(r, 1000))
    const retry = await withTimeout(
      supabase.from('usuarios').select('marmoraria_id, perfil').eq('id', userId).single(),
      8000,
      'fetchUsuarioInfo (retry)'
    )
    if (retry.error) {
      console.error('[AuthContext] Erro ao buscar usuarios (retry também falhou) — indeterminado:', retry.error)
      return undefined
    }
    return retry.data ? { marmoraria_id: retry.data.marmoraria_id ?? null, perfil: retry.data.perfil ?? null } : null
  } catch (err) {
    console.error('[AuthContext] fetchUsuarioInfo estourou o timeout — indeterminado:', err)
    return undefined
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [marmorariaId, setMarmorariaId] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Buscar sessão UMA vez no mount. Usamos getUser() em vez de getSession():
    // getUser() valida o token contra o servidor da Supabase, então se o token
    // salvo no localStorage dessa máquina estiver expirado/corrompido, ele
    // retorna erro em vez de "pendurar" a chamada — é isso que causava a tela
    // presa em "carregando" em algumas máquinas e não em outras.
    const initAuth = async () => {
      if (fetchedRef.current) return
      fetchedRef.current = true

      try {
        const { data: { user: authedUser }, error } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'getUser'
        )
        if (error || !authedUser) {
          if (error) console.error('[AuthContext] Sessão inválida, limpando:', error)
          await supabase.auth.signOut()
          setUser(null)
          setMarmorariaId(null)
          setPerfil(null)
        } else {
          setUser(authedUser)
          const result = await fetchUsuarioInfo(authedUser.id)
          // No carregamento inicial ainda não existe um valor anterior confiável
          // pra preservar, então indeterminado (undefined) vira null aqui.
          setMarmorariaId(result === undefined ? null : (result?.marmoraria_id ?? null))
          setPerfil(result === undefined ? null : (result?.perfil ?? null))
        }
      } catch (err) {
        // getUser() nem respondeu a tempo — provável sessão local corrompida.
        // Limpa e deixa o layout redirecionar pro /login em vez de travar.
        console.error('[AuthContext] initAuth estourou o timeout, limpando sessão local:', err)
        await supabase.auth.signOut().catch(() => {})
        setUser(null)
        setMarmorariaId(null)
        setPerfil(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Ouvir mudanças de sessão (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Token refresh não muda marmoraria — evitar re-fetch desnecessário
        if (event === 'TOKEN_REFRESHED') return
        // INITIAL_SESSION já tratado por initAuth acima
        if (event === 'INITIAL_SESSION') return

        if (!session?.user) {
          // O SDK acha que a sessão caiu (ex: SIGNED_OUT). Isso pode ser um
          // falso-positivo durante a renovação automática do token (aba em
          // segundo plano, token expirando no meio do preenchimento de um
          // orçamento longo, etc). Antes de derrubar o usuário e disparar o
          // redirecionamento para /cadastro, confirma direto com o servidor.
          try {
            const { data: { user: confirmedUser } } = await withTimeout(
              supabase.auth.getUser(),
              8000,
              'getUser (revalidação após possível SIGNED_OUT)'
            )
            if (confirmedUser) {
              // Falso alarme — a sessão continua válida, ignora o evento
              return
            }
          } catch (err) {
            console.error('[AuthContext] Falha ao revalidar sessão após SIGNED_OUT:', err)
          }
          setUser(null)
          setMarmorariaId(null)
          setPerfil(null)
          setLoading(false)
          return
        }

        setUser(session.user)
        const result = await fetchUsuarioInfo(session.user.id)
        if (result !== undefined) {
          setMarmorariaId(result?.marmoraria_id ?? null)
          setPerfil(result?.perfil ?? null)
        } else {
          // Não deu pra confirmar agora (falha transitória) — mantém o
          // marmorariaId/perfil atuais em vez de zerar e expulsar o usuário
          // para /cadastro no meio do que ele está fazendo.
          console.error('[AuthContext] Mantendo marmorariaId/perfil atuais — não foi possível confirmar nesse evento')
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, marmorariaId, perfil, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

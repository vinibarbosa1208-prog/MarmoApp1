'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  marmorariaId: string | null
  perfil: string | null
  loading: boolean
  // true quando NÃO foi possível confirmar marmoraria_id/perfil (falha
  // transitória de rede/timeout) — diferente de "confirmado que o usuário
  // não tem marmoraria". Quem consome isso (ex: PaymentGate) não deve
  // tratar authError como "sem cadastro" e mandar pra /cadastro.
  authError: boolean
  retryAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  marmorariaId: null,
  perfil: null,
  loading: true,
  authError: false,
  retryAuth: () => {},
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
  // 3 tentativas (com backoff) antes de desistir. Isso reduz bastante a
  // chance de um blip transitório (ex: cold start do banco logo após o
  // login) ser tratado como indeterminado — o que antes podia fazer um
  // usuário com cadastro válido ser mandado pra /cadastro por engano.
  const backoffsMs = [0, 1000, 2500]
  for (let attempt = 0; attempt < backoffsMs.length; attempt++) {
    if (backoffsMs[attempt] > 0) await new Promise(r => setTimeout(r, backoffsMs[attempt]))
    try {
      const { data, error } = await withTimeout(
        supabase.from('usuarios').select('marmoraria_id, perfil').eq('id', userId).single(),
        8000,
        `fetchUsuarioInfo (tentativa ${attempt + 1}/${backoffsMs.length})`
      )
      if (!error) return data ? { marmoraria_id: data.marmoraria_id ?? null, perfil: data.perfil ?? null } : null
      console.error(`[AuthContext] Erro ao buscar usuarios (tentativa ${attempt + 1}/${backoffsMs.length}):`, error)
    } catch (err) {
      console.error(`[AuthContext] fetchUsuarioInfo estourou o timeout (tentativa ${attempt + 1}/${backoffsMs.length}):`, err)
    }
  }
  console.error('[AuthContext] fetchUsuarioInfo esgotou todas as tentativas — indeterminado (NÃO é confirmação de "sem marmoraria")')
  return undefined
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [marmorariaId, setMarmorariaId] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const fetchedRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

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
          setAuthError(false)
        } else {
          setUser(authedUser)
          userIdRef.current = authedUser.id
          const result = await fetchUsuarioInfo(authedUser.id)
          if (result === undefined) {
            // Indeterminado (rede/timeout) — NÃO é a mesma coisa que "sem
            // marmoraria". Marca authError em vez de mandar o usuário pra
            // /cadastro por causa de uma falha transitória.
            setAuthError(true)
            setMarmorariaId(null)
            setPerfil(null)
          } else {
            setAuthError(false)
            setMarmorariaId(result?.marmoraria_id ?? null)
            setPerfil(result?.perfil ?? null)
          }
        }
      } catch (err) {
        // getUser() nem respondeu a tempo — provável sessão local corrompida.
        // Limpa e deixa o layout redirecionar pro /login em vez de travar.
        console.error('[AuthContext] initAuth estourou o timeout, limpando sessão local:', err)
        await supabase.auth.signOut().catch(() => {})
        setUser(null)
        setMarmorariaId(null)
        setPerfil(null)
        setAuthError(false)
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
          setAuthError(false)
          setLoading(false)
          return
        }

        setUser(session.user)
        userIdRef.current = session.user.id
        const result = await fetchUsuarioInfo(session.user.id)
        if (result !== undefined) {
          setAuthError(false)
          setMarmorariaId(result?.marmoraria_id ?? null)
          setPerfil(result?.perfil ?? null)
        } else {
          // Não deu pra confirmar agora (falha transitória) — mantém o
          // marmorariaId/perfil atuais em vez de zerar e expulsar o usuário
          // para /cadastro no meio do que ele está fazendo.
          setAuthError(true)
          console.error('[AuthContext] Mantendo marmorariaId/perfil atuais — não foi possível confirmar nesse evento')
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Permite re-tentar a busca de marmoraria_id/perfil sem precisar recarregar
  // a página — usado pelo PaymentGate quando authError fica true.
  const retryAuth = () => {
    const uid = userIdRef.current
    if (!uid) return
    fetchUsuarioInfo(uid).then(result => {
      if (result !== undefined) {
        setAuthError(false)
        setMarmorariaId(result?.marmoraria_id ?? null)
        setPerfil(result?.perfil ?? null)
      } else {
        setAuthError(true)
      }
    })
  }

  return (
    <AuthContext.Provider value={{ user, marmorariaId, perfil, loading, authError, retryAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

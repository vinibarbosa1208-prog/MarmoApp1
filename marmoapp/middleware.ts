import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware minimalista:
 * - Páginas: sem redirect — auth é feito client-side pelo AppLayout + AuthContext
 *   (evita redirect loop que o getSession() causava em instâncias edge paralelas do Vercel)
 * - APIs protegidas: valida via getUser() (sem refresh, sem race condition)
 */

const PROTECTED_API_PREFIXES = [
  '/api/orcamentos',
  '/api/clientes',
  '/api/agenda',
  '/api/insumos',
  '/api/configuracoes',
  '/api/setup',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtectedApi = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
  if (!isProtectedApi) {
    return NextResponse.next()
  }

  // Apenas para APIs protegidas: valida token via getUser()
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/api/:path*'],
}

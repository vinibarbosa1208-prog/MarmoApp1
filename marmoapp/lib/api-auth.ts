import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY não configurada. Verifique as variáveis de ambiente.')
}

export const apiSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

export async function getMarmorariaId(_ignored?: string | null): Promise<string | null> {
  const cookieStore = await cookies()

  const authClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Route handlers não podem definir cookies após o início da resposta
        }
      },
    },
  })

  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return null

  const { data, error: dbErr } = await authClient
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()

  if (dbErr) throw new Error(`auth_db: ${dbErr.message}`)
  if (data?.marmoraria_id) return data.marmoraria_id

  // Fallback: owner lookup (register flow only inserts into marmorarias, not usuarios)
  const { data: marmoraria } = await apiSupabase
    .from('marmorarias')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  return marmoraria?.id ?? null
}

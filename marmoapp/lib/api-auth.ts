import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Service role client — used by route handlers for all DB operations
export const apiSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Reads the Supabase session from cookies (set by createBrowserClient on the client)
// The _ignored param keeps callers that still pass the auth header working unchanged
export async function getMarmorariaId(_ignored?: string | null): Promise<string | null> {
  const cookieStore = await cookies()

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Route handlers cannot set cookies after the response has started
          }
        },
      },
    }
  )

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return null

  // Use authClient (user JWT) so the RLS policy USING (auth.uid() = id) is satisfied.
  // apiSupabase falls back to anon key when SUPABASE_SERVICE_KEY is absent in Vercel,
  // which causes "permission denied for table usuarios" on RLS-protected tables.
  const { data, error: dbErr } = await authClient
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()

  if (dbErr) throw new Error(`auth_db: ${dbErr.message}`)
  return data?.marmoraria_id ?? null
}

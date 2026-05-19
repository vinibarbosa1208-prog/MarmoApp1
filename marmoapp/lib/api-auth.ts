import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Service role client — used for DB operations (bypasses RLS)
export const apiSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

export async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token === 'null' || token === 'undefined') return null

  // Create a per-request client with the user JWT — recommended Supabase pattern for validating tokens
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null

  const { data } = await apiSupabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

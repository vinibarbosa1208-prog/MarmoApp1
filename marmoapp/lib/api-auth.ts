import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Service role client — DB operations (bypasses RLS)
export const apiSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Anon client — JWT validation only (separado para não interferir com service role)
const anonClient = createClient(SUPABASE_URL, ANON_KEY)

export async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token === 'null' || token === 'undefined') return null

  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error) console.error('[api-auth] getUser error:', error.message, '| token prefix:', token.slice(0, 20))
  if (!user) return null

  const { data } = await apiSupabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

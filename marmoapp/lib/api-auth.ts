import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token === 'null' || token === 'undefined') return null
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data } = await supabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', user.id)
    .maybeSingle()
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

export { supabase as apiSupabase }

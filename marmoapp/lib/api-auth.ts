import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Service role client — all DB operations
export const apiSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Decode JWT payload without network call — Supabase tokens are already signed at issuance
function decodeJwtSub(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf-8'))
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    // Reject expired tokens
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload.sub
  } catch {
    return null
  }
}

export async function getMarmorariaId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token === 'null' || token === 'undefined') return null

  const userId = decodeJwtSub(token)
  if (!userId) return null

  const { data, error } = await apiSupabase
    .from('usuarios')
    .select('marmoraria_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(`auth_db: ${error.message}`)
  return (data as { marmoraria_id: string } | null)?.marmoraria_id ?? null
}

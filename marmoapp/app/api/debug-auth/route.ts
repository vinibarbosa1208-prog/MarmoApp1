import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  const s1 = {
    header_present: !!authHeader,
    header_length: authHeader?.length ?? 0,
    header_prefix: authHeader ? authHeader.substring(0, 20) : null,
  }

  if (!authHeader) return NextResponse.json({ s1, s2: null, s3: null })

  const token = authHeader.replace('Bearer ', '').trim()

  const s2: Record<string, unknown> = {
    token_length: token.length,
    is_null_string: token === 'null' || token === 'undefined',
    parts_count: token.split('.').length,
    decode_ok: false,
    user_id_prefix: null,
    expired: null,
  }

  let userId: string | null = null
  try {
    const part = token.split('.')[1]
    if (part) {
      const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf-8'))
      userId = typeof payload.sub === 'string' ? payload.sub : null
      s2.decode_ok = !!userId
      s2.user_id_prefix = userId ? userId.substring(0, 8) + '...' : null
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000)
        s2.expired = now > payload.exp
        s2.exp_in_sec = payload.exp - now
      }
    }
  } catch (e) {
    s2.decode_error = String(e)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svcKey = process.env.SUPABASE_SERVICE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const usedKey = svcKey || anonKey

  const s3: Record<string, unknown> = {
    url_set: !!url,
    svc_key_set: !!svcKey,
    anon_key_set: !!anonKey,
    using_svc_key: !!svcKey,
    key_prefix: usedKey ? usedKey.substring(0, 30) + '...' : null,
    user_id: userId ? userId.substring(0, 8) + '...' : null,
    query_attempted: false,
    query_data: null,
    query_error: null,
  }

  if (url && usedKey && userId) {
    s3.query_attempted = true
    try {
      const sb = createClient(url, usedKey)
      const { data, error } = await sb
        .from('usuarios')
        .select('marmoraria_id')
        .eq('id', userId)
        .maybeSingle()
      s3.query_data = data ? 'row_found' : null
      s3.query_error = error ? `${error.code}: ${error.message}` : null
    } catch (e) {
      s3.query_error = String(e)
    }
  }

  return NextResponse.json({ s1, s2, s3 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { route, error_message, error_stack, user_id, marmoraria_id } = body as {
      route?: string
      error_message?: string
      error_stack?: string
      user_id?: string
      marmoraria_id?: string
    }

    await supabaseAdmin.from('error_logs').insert({
      route,
      error_message,
      error_stack,
      user_id: user_id ?? null,
      marmoraria_id: marmoraria_id ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
  }
}

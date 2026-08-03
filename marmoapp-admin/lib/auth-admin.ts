import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdminEmail } from './types'

async function makeSupabaseSSR() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function requireAdminAuth() {
  const supabase = await makeSupabaseSSR()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email || !isAdminEmail(user.email)) {
    redirect('/login')
  }

  return user
}

export async function getAdminUserForApi() {
  const supabase = await makeSupabaseSSR()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email || !isAdminEmail(user.email)) return null
  return user
}

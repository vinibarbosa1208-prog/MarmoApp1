'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import { isAdminEmail } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!isAdminEmail(email)) {
      setError('Acesso restrito a administradores MarmoApp.')
      setLoading(false)
      return
    }

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-marmoapp.jpg" alt="MarmoApp" className="mb-4 h-16 w-16 rounded-2xl object-cover shadow-sm" />
          <h1 className="font-serif text-3xl font-bold text-gray-900">
            Marmo<span className="text-gold">App</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Painel central · time interno</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gold focus:outline-none"
              placeholder="admin@marmoapp.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gold focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold py-2.5 text-sm font-medium text-[#0D0D0D] hover:bg-gold2 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

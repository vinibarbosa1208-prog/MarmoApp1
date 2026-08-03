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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-indigo-400">Marmo</span>
            <span className="text-white">App</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Painel Administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-slate-800 border border-slate-700 p-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              placeholder="admin@marmoapp.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

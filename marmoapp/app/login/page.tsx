'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); return }
      router.refresh()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/logo-marmoapp.jpg"
            alt="MarmoApp"
            style={{ width: 160, height: 'auto', objectFit: 'contain', marginBottom: 8 }}
          />
          <p>Gestão inteligente para marmorarias</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>E-MAIL</label>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          <label>SENHA</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && (
            <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>
          )}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar no sistema'}
          </button>
          <p className="auth-hint" style={{ marginTop: 14 }}>
            Não tem conta?{' '}
            <Link href="/register" style={{ color: 'var(--gold)' }}>
              Cadastrar minha marmoraria →
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

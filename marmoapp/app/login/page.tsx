'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Corrige bfcache: se o browser restaurar a página do cache com loading=true, reset
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Timeout de 20 segundos para evitar loading infinito
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      setLoading(false)
      setError('Conexão demorou demais. Verifique sua internet e tente novamente.')
    }, 20000)

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      clearTimeout(timeoutId)
      if (timedOut) return

      if (err) {
        const msg = err.message?.toLowerCase() ?? ''
        if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
          setError('E-mail ou senha incorretos.')
        } else if (msg.includes('email not confirmed')) {
          setError('Confirme seu e-mail antes de entrar.')
        } else {
          setError(err.message)
        }
        return
      }

      if (!data.session) {
        setError('Sessão não pôde ser estabelecida. Tente novamente.')
        return
      }

      // Hard redirect — garante que os cookies da sessão estejam no browser antes do middleware checar
      window.location.replace('/dashboard')
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (!timedOut) {
        const msg = err instanceof Error ? err.message : 'Erro ao entrar. Tente novamente.'
        setError(msg)
        setLoading(false)
      }
    } finally {
      // Só resetar loading em caso de erro (em caso de sucesso a página navega)
      // O `finally` roda antes da navegação — resetar aqui causaria flash do botão
      // então só resetamos se `loading` ainda é true e não houve navegação
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
            disabled={loading}
          />
          <label>SENHA</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
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

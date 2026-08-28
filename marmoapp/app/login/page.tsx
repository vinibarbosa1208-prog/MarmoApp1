'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigating = useRef(false)

  // Corrige bfcache: se browser restaurar a página do cache com loading=true, reset
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        navigating.current = false
        setLoading(false)
        setError('')
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loading || navigating.current) return
    setError('')
    setLoading(true)

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

      if (err) {
        const msg = err.message?.toLowerCase() ?? ''
        if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
          setError('E-mail ou senha incorretos.')
        } else if (msg.includes('email not confirmed')) {
          setError('Confirme seu e-mail antes de entrar.')
        } else {
          setError(err.message)
        }
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('Não foi possível estabelecer a sessão. Tente novamente.')
        setLoading(false)
        return
      }

      // Instalador tem portal próprio, restrito — não usa o app completo.
      const { data: usuarioRow } = await supabase
        .from('usuarios')
        .select('perfil')
        .eq('id', data.session.user.id)
        .maybeSingle()

      // Marca como navegando para não resetar o estado no bfcache antes de ir
      navigating.current = true
      window.location.replace(usuarioRow?.perfil === 'instalador' ? '/portal-instalador' : '/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar. Tente novamente.'
      setError(msg)
      setLoading(false)
      navigating.current = false
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

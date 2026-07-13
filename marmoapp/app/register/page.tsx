'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    nome: searchParams.get('nome') ?? '',
    email: searchParams.get('email') ?? '',
    pass: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.fbq?.('track', 'Lead')
  }, [])

  function up(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.pass) { setError('Preencha todos os campos'); return }
    if (form.pass.length < 6) { setError('Senha mínimo 6 caracteres'); return }

    setLoading(true)
    setError('')

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.pass,
        options: { data: { nome: form.nome } },
      })
      if (signUpErr) throw signUpErr
      if (!data.user) throw new Error('Usuário não criado')

      // signUp pode não estabelecer sessão se havia sessão anterior ativa
      // ou se o projeto exige confirmação de e-mail. Força login explícito.
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.pass,
        })
        if (signInErr) throw signInErr
      }

      const plano = searchParams.get('plano') ?? 'basic'
      localStorage.setItem('marmoapp_plano', plano)
      localStorage.setItem('marmoapp_nome_contato', form.nome)

      window.fbq?.('track', 'CompleteRegistration')

      router.push('/onboarding')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-text">
            <span className="logo-marmo">marmo</span><span className="logo-app">app</span>
          </div>
          <p>Gestão inteligente para marmorarias</p>
        </div>

        <div className="auth-form">
          <div className="step-title">Crie sua conta</div>
          <div className="step-subtitle">7 dias grátis · sem cartão de crédito</div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>SEU NOME COMPLETO</label>
              <input
                type="text"
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => up('nome', e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>E-MAIL</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => up('email', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>SENHA (mínimo 6 caracteres)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.pass}
                onChange={e => up('pass', e.target.value)}
              />
            </div>

            {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: 12 }} disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta →'}
            </button>
          </form>

          <p className="auth-hint">
            Já tem conta?{' '}
            <Link href="/login" style={{ color: 'var(--gold)' }}>Entrar →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

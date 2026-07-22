'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

const PLANOS = [
  {
    id: 'basic',
    label: 'Basic',
    preco: 'R$ 147',
    periodo: '/mês',
    descricao: 'Até 2 usuários',
    popular: false,
  },
  {
    id: 'pro',
    label: 'Pro',
    preco: 'R$ 297',
    periodo: '/mês',
    descricao: 'Até 5 usuários · Antonio AI',
    popular: true,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    preco: 'R$ 497',
    periodo: '/mês',
    descricao: 'Usuários ilimitados · Suporte dedicado',
    popular: false,
  },
]

function CadastroForm() {
  const router  = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    marmoraria: searchParams.get('marmoraria') ?? '',
    email:      searchParams.get('email')      ?? '',
    telefone:   '',
    cidade:     '',
    cnpj:       '',
    senha:      '',
    plano:      (searchParams.get('plano') ?? 'pro') as 'basic' | 'pro' | 'enterprise',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const firstInputRef         = useRef<HTMLInputElement>(null)

  useEffect(() => { firstInputRef.current?.focus() }, [])

  function maskPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length > 6) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`
    if (d.length > 0) return `(${d}`
    return ''
  }

  function maskCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length > 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    if (d.length > 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    if (d.length > 5)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length > 2)  return `${d.slice(0,2)}.${d.slice(2)}`
    return d
  }

  function up(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    const { marmoraria, email, telefone, cidade, cnpj, senha, plano } = form

    if (!marmoraria.trim()) return setError('Informe o nome da marmoraria.')
    if (!email.includes('@'))  return setError('Informe um e-mail válido.')
    if (!telefone.trim())      return setError('Informe seu WhatsApp.')
    if (!cidade.trim())        return setError('Informe sua cidade.')
    if (senha.length < 6)      return setError('Senha deve ter pelo menos 6 caracteres.')

    setLoading(true)
    setError('')

    try {
      // 1. Cria usuário no Supabase Auth
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome: marmoraria } },
      })

      if (signUpErr) {
        const msg = signUpErr.message ?? ''
        if (msg.includes('already registered') || msg.includes('User already registered')) {
          const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: senha })
          if (loginErr) {
            setLoading(false)
            return setError('Este e-mail já está cadastrado. Verifique sua senha ou acesse o sistema.')
          }
        } else {
          setLoading(false)
          return setError(msg || 'Erro ao criar conta. Tente novamente.')
        }
      }

      // 2. Garante sessão ativa (necessário para o checkout API ler cookies)
      let { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (loginErr) {
          setLoading(false)
          if (loginErr.message.toLowerCase().includes('email not confirmed')) {
            return setError('Verifique seu e-mail e clique no link de confirmação para continuar.')
          }
          return setError('Conta criada! Acesse o sistema para entrar.')
        }
        session = loginData.session
      }

      if (!session) {
        setLoading(false)
        return setError('Conta criada! Faça login para acessar o sistema.')
      }

      // 3. Dispara lead (sem aguardar)
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_marmoraria: marmoraria, nome_contato: email, whatsapp: telefone, email }),
      }).catch(() => {})

      window.fbq?.('track', 'CompleteRegistration')

      // 4. Cria marmoraria + Checkout Stripe num único passo server-side
      //    O route.ts usa apiSupabase (service role) para criar a marmoraria — sem problemas de RLS
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plano, nome: marmoraria, cnpj, telefone, cidade, email }),
      })

      if (!checkoutRes.ok) {
        // Se Stripe falhar, entra no sistema mesmo assim
        console.error('[cadastro] stripe checkout error:', await checkoutRes.text())
        router.push('/dashboard')
        return
      }

      const { url } = await checkoutRes.json()

      if (url) {
        setSuccess(true)
        // Redireciona para o Stripe Checkout (após confirmação → /dashboard?checkout=success)
        window.location.href = url
      } else {
        router.push('/dashboard')
      }

    } catch (err: unknown) {
      setLoading(false)
      setError('Erro inesperado. Tente novamente.')
      console.error(err)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#F8F6F2',
    border: '1px solid #EDE9E2',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: '#2C2922',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#9B8A7A',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::placeholder { color: #9B8A7A; opacity: 0.6; }
        input:focus { outline: none; border-color: #C9A84C !important; }
        a { color: #C9A84C; text-decoration: none; }
        a:hover { text-decoration: underline; }
        button { cursor: pointer; }
        button:hover:not(:disabled) { opacity: 0.9; }
        .plano-card { transition: border-color 0.15s, box-shadow 0.15s; cursor: pointer; }
        .plano-card:hover { border-color: #C9A84C !important; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(180deg,#0a0a0a 0%,#111111 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 20px 64px',
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: 'border-box',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, letterSpacing: '0.3px' }}>
            <span style={{ color: '#ffffff' }}>Marmo</span><span style={{ color: '#C9A84C' }}>App</span>
          </div>
          <div style={{ color: '#8a8a8a', fontSize: 13 }}>
            7 dias grátis · sem cobrança imediata
          </div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 520,
          background: '#F8F6F2',
          borderRadius: 20,
          border: '1px solid rgba(201,168,76,0.35)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>

          {/* Barra dourada */}
          <div style={{ height: 5, width: '100%', background: 'linear-gradient(90deg,#C9A84C,#E5C46A,#C9A84C)' }} />

          <div style={{ padding: '28px 32px 32px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: '#2C2922', marginBottom: 4 }}>
              Crie sua conta
            </div>
            <div style={{ fontSize: 14, color: '#9B8A7A', marginBottom: 24 }}>
              Configure sua marmoraria em menos de 2 minutos
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#2C2922' }}>Conta criada!</p>
                <p style={{ fontSize: 14, color: '#9B8A7A', marginTop: 6 }}>Redirecionando para o pagamento...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Nome da marmoraria</label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    placeholder="Ex: Marmoraria Real Pedras"
                    value={form.marmoraria}
                    onChange={e => up('marmoraria', e.target.value)}
                    autoComplete="organization"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    placeholder="voce@email.com"
                    value={form.email}
                    onChange={e => up('email', e.target.value)}
                    autoComplete="email"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={labelStyle}>WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={form.telefone}
                      onChange={e => up('telefone', maskPhone(e.target.value))}
                      autoComplete="tel"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={labelStyle}>Cidade</label>
                    <input
                      type="text"
                      placeholder="São Paulo"
                      value={form.cidade}
                      onChange={e => up('cidade', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={labelStyle}>CNPJ (opcional)</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={form.cnpj}
                      onChange={e => up('cnpj', maskCNPJ(e.target.value))}
                      maxLength={18}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={labelStyle}>Senha</label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={form.senha}
                      onChange={e => up('senha', e.target.value)}
                      autoComplete="new-password"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Seleção de plano */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <label style={labelStyle}>Escolha seu plano</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PLANOS.map(p => {
                      const selected = form.plano === p.id
                      return (
                        <div
                          key={p.id}
                          className="plano-card"
                          onClick={() => up('plano', p.id)}
                          style={{
                            flex: 1,
                            background: selected ? 'rgba(201,168,76,0.08)' : '#fff',
                            border: selected ? '2px solid #C9A84C' : '1.5px solid #EDE9E2',
                            borderRadius: 10,
                            padding: '11px 10px',
                            textAlign: 'center',
                            position: 'relative',
                          }}
                        >
                          {p.popular && (
                            <div style={{
                              position: 'absolute',
                              top: -10,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: '#C9A84C',
                              color: '#2C2922',
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              padding: '2px 8px',
                              borderRadius: 20,
                              whiteSpace: 'nowrap',
                            }}>MAIS POPULAR</div>
                          )}
                          <div style={{ fontSize: 11, fontWeight: 700, color: selected ? '#C9A84C' : '#9B8A7A', marginBottom: 3 }}>
                            {p.label}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: selected ? '#2C2922' : '#5a4e44', lineHeight: 1 }}>
                            {p.preco}
                          </div>
                          <div style={{ fontSize: 9, color: '#9B8A7A', marginBottom: 4 }}>{p.periodo}</div>
                          <div style={{ fontSize: 10, color: '#9B8A7A', lineHeight: 1.4 }}>{p.descricao}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#DC2626',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? '#D4B96A' : '#C9A84C',
                    color: '#2C2922',
                    fontWeight: 700,
                    fontSize: 15,
                    border: 'none',
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 4,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: loading ? 'wait' : 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {loading ? 'Criando sua conta...' : 'Continuar para pagamento →'}
                </button>

                {/* Trial badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#9B8A7A',
                  marginTop: 2,
                }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="#22c55e" strokeWidth="1.4"/>
                    <path d="M5 8l2 2 4-4" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>7 dias grátis · seu cartão <strong>não</strong> será cobrado agora</span>
                </div>

                <div style={{ textAlign: 'center', fontSize: 12, color: '#9B8A7A', lineHeight: 1.5 }}>
                  Ao continuar você concorda com os{' '}
                  <a href="/termos" style={{ color: '#C9A84C' }}>termos de uso</a>.
                </div>

              </form>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 14, color: '#9B8A7A' }}>
          Já tem conta?{' '}
          <a href="/login" style={{ color: '#C9A84C', fontWeight: 600 }}>Entrar →</a>
        </div>

      </div>
    </>
  )
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  )
}

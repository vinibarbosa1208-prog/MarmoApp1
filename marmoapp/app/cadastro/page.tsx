'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

function CadastroForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    marmoraria: searchParams.get('marmoraria') ?? '',
    email:      searchParams.get('email')      ?? '',
    telefone:   '',
    cidade:     '',
    cnpj:       '',
    senha:      '',
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

    const { marmoraria, email, telefone, cidade, cnpj, senha } = form

    if (!marmoraria.trim()) return setError('Informe o nome da marmoraria.')
    if (!email.includes('@'))  return setError('Informe um e-mail válido.')
    if (!telefone.trim())      return setError('Informe seu WhatsApp.')
    if (!cidade.trim())        return setError('Informe sua cidade.')
    if (senha.length < 6)      return setError('Senha deve ter pelo menos 6 caracteres.')

    setLoading(true)
    setError('')

    try {
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

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_marmoraria: marmoraria, nome_contato: email, whatsapp: telefone, email }),
      }).catch(() => {})

      const trialExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: marmErr } = await supabase.from('marmorarias').insert({
        owner_id: session.user.id,
        nome:     marmoraria.trim(),
        cnpj:     cnpj || null,
        telefone,
        cidade,
        email,
        plano:           'basic',
        trial_expira:    trialExpira,
        setup_concluido: true,
      })

      if (marmErr && marmErr.code !== '23505') {
        console.warn('[cadastro] marmoraria insert:', marmErr.message)
      }

      window.fbq?.('track', 'CompleteRegistration')
      setSuccess(true)
      router.push('/dashboard')

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
        button:hover:not(:disabled) { background: #E5C46A !important; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(180deg,#0a0a0a 0%,#111111 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '64px 20px',
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: 'border-box',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, letterSpacing: '0.3px' }}>
            <span style={{ color: '#ffffff' }}>Marmo</span><span style={{ color: '#C9A84C' }}>App</span>
          </div>
          <div style={{ color: '#8a8a8a', fontSize: 13, letterSpacing: '0.2px' }}>
            7 dias grátis · sem cartão de crédito
          </div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          background: '#F8F6F2',
          borderRadius: 20,
          border: '1px solid rgba(201,168,76,0.35)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>

          {/* Barra dourada */}
          <div style={{ height: 5, width: '100%', background: 'linear-gradient(90deg,#C9A84C,#E5C46A,#C9A84C)' }} />

          <div style={{ padding: 32 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: '#2C2922', marginBottom: 6 }}>
              Crie sua conta
            </div>
            <div style={{ fontSize: 14, color: '#9B8A7A', marginBottom: 28 }}>
              Configure sua marmoraria em menos de 2 minutos
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#2C2922' }}>Conta criada!</p>
                <p style={{ fontSize: 14, color: '#9B8A7A', marginTop: 6 }}>Abrindo o sistema...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    marginTop: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: loading ? 'wait' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? 'Criando sua conta...' : 'Criar conta e entrar →'}
                </button>

                <div style={{ textAlign: 'center', fontSize: 12, color: '#9B8A7A', marginTop: 2, lineHeight: 1.5 }}>
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

'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPhone, formatCEP, formatCNPJ, fetchCEP } from '@/lib/utils'

type Step = 1 | 2 | 3
type Plan = 'basic' | 'pro' | 'enterprise'

const PLANS = {
  basic:      { nome: 'Plano Basic',      preco: 'R$ 147/mês' },
  pro:        { nome: 'Plano Pro',        preco: 'R$ 297/mês' },
  enterprise: { nome: 'Plano Enterprise', preco: 'R$ 497/mês' },
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [plan, setPlan] = useState<Plan>(() => {
    const p = searchParams.get('plano')
    return (p === 'pro' || p === 'enterprise') ? p : 'basic'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nome: '', email: '', pass: '',
    marmoraria: '', cnpj: '', tel: '',
    cep: '', estado: '', cidade: '', endereco: '',
  })

  function up(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function validateStep1() {
    if (!form.nome || !form.email || !form.pass) { setError('Preencha todos os campos'); return false }
    if (form.pass.length < 6) { setError('Senha mínimo 6 caracteres'); return false }
    return true
  }

  function validateStep2() {
    if (!form.marmoraria || !form.tel) { setError('Nome da marmoraria e telefone são obrigatórios'); return false }
    return true
  }

  async function handleCEP() {
    const data = await fetchCEP(form.cep)
    if (data) {
      setForm(f => ({
        ...f,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
        endereco: data.logradouro || f.endereco,
      }))
    }
  }

  async function handleRegister() {
    setError('')
    setLoading(true)
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.pass,
        options: { data: { nome: form.nome } },
      })
      if (signUpErr) throw signUpErr
      if (!data.user) throw new Error('Usuário não criado')

      const trialExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: marmErr } = await supabase.from('marmorarias').insert({
        owner_id: data.user.id,
        nome: form.marmoraria,
        cnpj: form.cnpj,
        telefone: form.tel,
        cep: form.cep,
        estado: form.estado,
        cidade: form.cidade,
        endereco: form.endereco,
        plano: plan,
        email: form.email,
        trial_expira: trialExpira,
      })
      if (marmErr) throw marmErr

      router.push('/dashboard')
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
          <div className="step-indicator">
            <div className={`step-dot${step >= 1 ? ' active' : ''}`} />
            <div className={`step-dot${step >= 2 ? ' active' : ''}`} />
            <div className={`step-dot${step >= 3 ? ' active' : ''}`} />
          </div>

          {step === 1 && (
            <div>
              <div className="step-title">Dados da sua conta</div>
              <div className="step-subtitle">Informações de acesso ao sistema</div>
              <div className="input-group">
                <label>SEU NOME COMPLETO</label>
                <input type="text" placeholder="Nome completo" value={form.nome} onChange={e => up('nome', e.target.value)} />
              </div>
              <div className="input-group">
                <label>E-MAIL</label>
                <input type="email" placeholder="seu@email.com" value={form.email} onChange={e => up('email', e.target.value)} />
              </div>
              <div className="input-group">
                <label>SENHA (mínimo 6 caracteres)</label>
                <input type="password" placeholder="••••••••" value={form.pass} onChange={e => up('pass', e.target.value)} />
              </div>
              {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button className="btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => { if (validateStep1()) { setError(''); setStep(2) } }}>
                Continuar
              </button>
              <p className="auth-hint"><Link href="/login" style={{ color: 'var(--gold)' }}>← Voltar para o login</Link></p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="step-title">Dados da Marmoraria</div>
              <div className="step-subtitle">Informações do seu negócio</div>
              <div className="input-group">
                <label>NOME DA MARMORARIA</label>
                <input type="text" placeholder="Ex: Real Pedras Marmoraria" value={form.marmoraria} onChange={e => up('marmoraria', e.target.value)} />
              </div>
              <div className="input-group">
                <label>CNPJ</label>
                <input type="text" placeholder="00.000.000/0001-00" maxLength={18} value={form.cnpj} onChange={e => up('cnpj', formatCNPJ(e.target.value))} />
              </div>
              <div className="input-group">
                <label>TELEFONE / WHATSAPP</label>
                <input type="text" placeholder="(00) 00000-0000" maxLength={15} value={form.tel} onChange={e => up('tel', formatPhone(e.target.value))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group">
                  <label>CEP</label>
                  <input type="text" placeholder="00000-000" maxLength={9} value={form.cep}
                    onChange={e => up('cep', formatCEP(e.target.value))}
                    onBlur={handleCEP} />
                </div>
                <div className="input-group">
                  <label>ESTADO</label>
                  <input type="text" placeholder="SP" maxLength={2} value={form.estado} onChange={e => up('estado', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label>CIDADE</label>
                <input type="text" placeholder="Sua cidade" value={form.cidade} onChange={e => up('cidade', e.target.value)} />
              </div>
              <div className="input-group">
                <label>ENDEREÇO</label>
                <input type="text" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => up('endereco', e.target.value)} />
              </div>
              {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button className="btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => { if (validateStep2()) { setError(''); setStep(3) } }}>
                Continuar
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="step-title">Escolha seu Plano</div>
              <div className="step-subtitle">Comece com 7 dias grátis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
                {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlan(key)}
                    style={{
                      background: key === plan ? 'var(--sidebar-active-bg)' : '#f8f8f8',
                      border: key === plan ? '1.5px solid var(--gold)' : '1.5px solid #e8e8e8',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer', width: '100%', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 14 }}>{p.preco}</span>
                  </button>
                ))}
              </div>
              {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button type="button" className="btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={handleRegister} disabled={loading}>
                {loading ? 'Criando conta...' : 'Criar conta e começar →'}
              </button>
              <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
            </div>
          )}
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

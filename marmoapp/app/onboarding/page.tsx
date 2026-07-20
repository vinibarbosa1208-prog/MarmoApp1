'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPhone, formatCEP, formatCNPJ, fetchCEP } from '@/lib/utils'

type Step = 1 | 2

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    marmoraria: '',
    cnpj: '',
    tel: '',
    cep: '',
    estado: '',
    cidade: '',
    endereco: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      // Se usuário já tem marmoraria configurada, redireciona para o dashboard
      // Evita sobrescrever dados com formulário vazio
      const { data: marmoraria } = await supabase
        .from('marmorarias')
        .select('id, setup_concluido')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (marmoraria?.setup_concluido) {
        router.replace('/dashboard')
      }
    })
  }, [router])

  function up(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
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

  function validateStep1() {
    if (!form.marmoraria) { setError('Nome da marmoraria é obrigatório'); return false }
    if (!form.tel) { setError('Telefone é obrigatório'); return false }
    return true
  }

  async function handleFinish() {
    if (!userId) {
      setError('Sessão expirada. Faça login novamente.')
      router.replace('/login')
      return
    }
    setLoading(true)
    setError('')

    try {
      const plano = localStorage.getItem('marmoapp_plano') ?? 'basic'

      const { data: existing } = await supabase
        .from('marmorarias')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()

      if (existing) {
        const { error: updateErr } = await supabase
          .from('marmorarias')
          .update({
            nome: form.marmoraria,
            cnpj: form.cnpj || null,
            telefone: form.tel,
            cep: form.cep || null,
            estado: form.estado || null,
            cidade: form.cidade || null,
            endereco: form.endereco || null,
            plano,
            setup_concluido: true,
          })
          .eq('id', existing.id)
        if (updateErr) throw updateErr
      } else {
        const trialExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const { error: insertErr } = await supabase
          .from('marmorarias')
          .insert({
            owner_id: userId,
            nome: form.marmoraria,
            cnpj: form.cnpj || null,
            telefone: form.tel,
            cep: form.cep || null,
            estado: form.estado || null,
            cidade: form.cidade || null,
            endereco: form.endereco || null,
            plano,
            email: userEmail,
            trial_expira: trialExpira,
            setup_concluido: true,
          })
        if (insertErr) throw insertErr
      }

      localStorage.removeItem('marmoapp_plano')
      localStorage.removeItem('marmoapp_nome_contato')

      router.push('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao configurar sua conta')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    border: '1.5px solid #EDE9E2', fontSize: 14, color: '#2C2922',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#9B8A7A', marginBottom: 5, letterSpacing: 0.5,
    textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2C2922', letterSpacing: -0.5 }}>
            Marmo<span style={{ color: '#C9A84C' }}>App</span>
          </div>
          <p style={{ color: '#9B8A7A', fontSize: 13, marginTop: 6 }}>Sua conta foi criada! Agora configure sua marmoraria.</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {([1, 2] as Step[]).map(s => (
            <div
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= step ? '#C9A84C' : '#EDE9E2',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 16px rgba(44,41,34,0.07)', border: '1px solid #EDE9E2' }}>

          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#2C2922', margin: '0 0 4px' }}>
                Dados da marmoraria
              </h2>
              <p style={{ fontSize: 13, color: '#9B8A7A', margin: '0 0 24px' }}>
                Essas informações aparecem nos orçamentos gerados.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nome da marmoraria <span style={{ color: '#C0392B' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Ex: Real Pedras Marmoraria"
                    value={form.marmoraria}
                    onChange={e => up('marmoraria', e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Telefone / WhatsApp <span style={{ color: '#C0392B' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="tel"
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    value={form.tel}
                    onChange={e => up('tel', formatPhone(e.target.value))}
                  />
                </div>

                <div>
                  <label style={labelStyle}>CNPJ <span style={{ color: '#9B8A7A', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    value={form.cnpj}
                    onChange={e => up('cnpj', formatCNPJ(e.target.value))}
                  />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { if (validateStep1()) { setError(''); setStep(2) } }}
                  style={{ width: '100%', padding: '13px 0', background: '#C9A84C', color: '#2C2922', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#2C2922', margin: '0 0 4px' }}>
                Localização
              </h2>
              <p style={{ fontSize: 13, color: '#9B8A7A', margin: '0 0 24px' }}>
                Opcional — pode preencher depois nas configurações.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>CEP</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="00000-000"
                      maxLength={9}
                      value={form.cep}
                      onChange={e => up('cep', formatCEP(e.target.value))}
                      onBlur={handleCEP}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Estado</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="SP"
                      maxLength={2}
                      value={form.estado}
                      onChange={e => up('estado', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Cidade</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Sua cidade"
                    value={form.cidade}
                    onChange={e => up('cidade', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Endereço</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Rua, número, bairro"
                    value={form.endereco}
                    onChange={e => up('endereco', e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  style={{ width: '100%', padding: '13px 0', background: '#C9A84C', color: '#2C2922', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Configurando...' : 'Entrar no MarmoApp →'}
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  style={{ width: '100%', padding: '11px 0', background: 'transparent', color: '#9B8A7A', border: 'none', fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}
                >
                  Pular por agora →
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ background: 'none', border: 'none', color: '#9B8A7A', cursor: 'pointer', fontSize: 13, marginTop: 8, padding: 0 }}
              >
                ← Voltar
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9B8A7A' }}>
          Pode configurar tudo isso depois em <strong>Configurações</strong>.
        </p>
      </div>
    </div>
  )
}

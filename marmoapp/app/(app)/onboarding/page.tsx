'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { formatPhone } from '@/lib/utils'
import type { Material } from '@/lib/types'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const DEFAULT_MATERIAIS = [
  { nome: 'Granito Branco Siena',   tipo: 'Granito',     unidade: 'm²' },
  { nome: 'Mármore Branco Carrara', tipo: 'Mármore',     unidade: 'm²' },
  { nome: 'Porcelanato Polido',     tipo: 'Porcelanato', unidade: 'm²' },
  { nome: 'Quartzito White',        tipo: 'Quartzito',   unidade: 'm²' },
  { nome: 'Silestone Branco',       tipo: 'Silestone',   unidade: 'm²' },
]

type Step = 1 | 2 | 3 | 4

const STEP_LABELS = ['Dados', 'Logo', 'Markup', 'Materiais']

export default function OnboardingPage() {
  const { marmoraria, toast, loadMarmoraria } = useApp()
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('SP')

  // Step 2
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 3
  const [markup, setMarkup] = useState(3)

  // Step 4
  const [materiais, setMateriais] = useState<Material[]>([])
  const [precos, setPrecos] = useState<Record<string, number>>({})
  const [loadingMateriais, setLoadingMateriais] = useState(false)

  // Pre-fill from marmoraria when loaded
  useEffect(() => {
    if (!marmoraria) return
    setNome(marmoraria.nome || '')
    setTelefone(marmoraria.telefone || '')
    setCidade(marmoraria.cidade || '')
    setEstado(marmoraria.estado || 'SP')
    setMarkup(marmoraria.markup_padrao ?? 3)
  }, [marmoraria?.id])

  // Load or seed materiais when entering step 4
  useEffect(() => {
    if (step !== 4 || !marmoraria?.id) return

    async function loadOrSeed() {
      setLoadingMateriais(true)
      try {
        const { data } = await supabase
          .from('materiais')
          .select('*')
          .eq('marmoraria_id', marmoraria!.id)
          .order('nome')
          .limit(5)

        if (data && data.length > 0) {
          setMateriais(data as Material[])
          const init: Record<string, number> = {}
          data.forEach(m => { init[m.id] = m.custo_unitario ?? m.preco_unitario ?? 0 })
          setPrecos(init)
        } else {
          const toInsert = DEFAULT_MATERIAIS.map(m => ({ ...m, marmoraria_id: marmoraria!.id, custo_unitario: 0 }))
          const { data: inserted } = await supabase.from('materiais').insert(toInsert).select()
          if (inserted) {
            setMateriais(inserted as Material[])
            const init: Record<string, number> = {}
            inserted.forEach((m: Material) => { init[m.id] = 0 })
            setPrecos(init)
          }
        }
      } finally {
        setLoadingMateriais(false)
      }
    }

    loadOrSeed()
  }, [step, marmoraria?.id])

  function go(s: Step) { setError(''); setStep(s) }

  // ─── Step saves ──────────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!nome.trim() || !telefone.trim() || !cidade.trim()) {
      setError('Preencha todos os campos obrigatórios')
      return false
    }
    if (!marmoraria) return false
    setLoading(true)
    try {
      const { error: err } = await supabase
        .from('marmorarias')
        .update({ nome: nome.trim(), telefone: telefone.trim(), cidade: cidade.trim(), estado })
        .eq('id', marmoraria.id)
      if (err) throw err
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function saveStep2() {
    if (!logoFile || !marmoraria) return true
    setLoading(true)
    try {
      const ext = logoFile.name.split('.').pop()
      const path = `${marmoraria.id}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      const { error: updateErr } = await supabase
        .from('marmorarias')
        .update({ logo_url: publicUrl })
        .eq('id', marmoraria.id)
      if (updateErr) throw updateErr
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar logo')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function saveStep3() {
    if (!marmoraria) return false
    setLoading(true)
    try {
      const { error: err } = await supabase
        .from('marmorarias')
        .update({ markup_padrao: markup })
        .eq('id', marmoraria.id)
      if (err) throw err
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function conclude() {
    if (!marmoraria) return
    setLoading(true)
    setError('')
    try {
      await Promise.all(
        materiais.map(m =>
          supabase.from('materiais')
            .update({ custo_unitario: precos[m.id] ?? 0 })
            .eq('id', m.id)
        )
      )

      const res = await fetch('/api/setup/seed-defaults', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao concluir setup')
      }

      await loadMarmoraria()
      toast('Bem-vindo ao MarmoApp! Sua marmoraria está pronta.', 'ok2')
      router.replace('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir')
      setLoading(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Arquivo muito grande. Máximo 2 MB.'); return }
    if (!file.type.startsWith('image/')) { setError('Formato inválido. Use JPG ou PNG.'); return }
    setError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const pct = (step / 4) * 100

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--page-bg)',
      backgroundImage: [
        'repeating-linear-gradient(45deg, rgba(201,168,76,0.04) 0px, rgba(201,168,76,0.04) 1px, transparent 1px, transparent 60px)',
        'repeating-linear-gradient(-45deg, rgba(201,168,76,0.04) 0px, rgba(201,168,76,0.04) 1px, transparent 1px, transparent 60px)',
      ].join(', '),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 540 }}>

        {/* Logo mark */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700 }}>
            <span style={{ color: 'var(--dark)' }}>marmo</span>
            <span style={{ color: 'var(--gold)' }}>app</span>
          </div>
          <p style={{ color: 'var(--gray)', fontSize: 13, marginTop: 6 }}>
            Configure sua marmoraria em 4 etapas rápidas
          </p>
        </div>

        <div className="card" style={{ padding: '32px 36px' }}>

          {/* Progress */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600, letterSpacing: 0.5 }}>
                ETAPA {step} DE 4
              </span>
              <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                {Math.round(pct)}%
              </span>
            </div>
            <div style={{ height: 5, background: 'var(--marble2)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--gold), var(--gold2))',
                borderRadius: 4, transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {STEP_LABELS.map((label, i) => {
                const n = i + 1
                const done = step > n
                const cur = step === n
                return (
                  <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', margin: '0 auto 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: done ? 'var(--green)' : cur ? 'var(--gold)' : 'var(--marble2)',
                      color: done || cur ? '#fff' : 'var(--gray)',
                      transition: 'background 0.3s',
                    }}>
                      {done ? '✓' : n}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: cur ? 600 : 400,
                      color: cur ? 'var(--gold)' : done ? 'var(--green)' : 'var(--gray)',
                    }}>
                      {label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Global error */}
          {error && (
            <div style={{
              background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          {/* ── ETAPA 1: Dados ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 600, marginBottom: 4 }}>
                Dados da marmoraria
              </h2>
              <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 22 }}>
                Informações básicas para personalizar seu sistema
              </p>

              <div className="form-group">
                <label className="form-label">NOME DA MARMORARIA *</label>
                <input className="form-input" placeholder="Ex: Real Pedras Marmoraria"
                  value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">TELEFONE / WHATSAPP *</label>
                <input className="form-input" placeholder="(00) 00000-0000" maxLength={15}
                  value={telefone} onChange={e => setTelefone(formatPhone(e.target.value))} />
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: 18 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CIDADE *</label>
                  <input className="form-input" placeholder="Sua cidade"
                    value={cidade} onChange={e => setCidade(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ESTADO</label>
                  <select className="form-select" value={estado} onChange={e => setEstado(e.target.value)}>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-gold" disabled={loading}
                  onClick={async () => { const ok = await saveStep1(); if (ok) go(2) }}>
                  {loading ? 'Salvando...' : 'Continuar →'}
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 2: Logo ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 600, marginBottom: 4 }}>
                Logo da marmoraria
              </h2>
              <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 22 }}>
                Aparece nos orçamentos em PDF · JPG, PNG ou WebP · máx. 2 MB
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${logoPreview ? 'var(--gold)' : 'var(--marble2)'}`,
                  borderRadius: 12, cursor: 'pointer', marginBottom: 16, transition: 'border-color 0.2s',
                  padding: logoPreview ? '16px' : '36px 20px', textAlign: 'center',
                  background: logoPreview ? 'rgba(201,168,76,0.04)' : 'transparent',
                }}
                onMouseOver={e => { if (!logoPreview) e.currentTarget.style.borderColor = 'var(--gold)' }}
                onMouseOut={e => { if (!logoPreview) e.currentTarget.style.borderColor = 'var(--marble2)' }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview da logo" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 38, opacity: 0.5, marginBottom: 10 }}>🖼</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 4 }}>Clique para selecionar a logo</div>
                    <div style={{ fontSize: 12, color: 'var(--gray)' }}>JPG, PNG ou WebP · máx. 2 MB</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }} onChange={handleFile} />

              {logoFile && (
                <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📎 {logoFile.name} ({(logoFile.size / 1024).toFixed(0)} KB)</span>
                  <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>
                    remover
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, alignItems: 'center' }}>
                <button className="btn btn-ghost" onClick={() => go(1)}>← Voltar</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => go(3)}>Pular etapa</button>
                  <button className="btn btn-gold" disabled={loading || !logoFile}
                    onClick={async () => { const ok = await saveStep2(); if (ok) go(3) }}>
                    {loading ? 'Enviando...' : 'Salvar e continuar →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Markup ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 600, marginBottom: 4 }}>
                Markup padrão
              </h2>
              <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 22 }}>
                Multiplica o custo do material para chegar no preço de venda
              </p>

              <div style={{ background: 'var(--marble)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontSize: 14, color: 'var(--gray)' }}>Multiplicador</span>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: 'var(--gold)' }}>
                    {markup % 1 === 0 ? `${markup}x` : `${markup.toFixed(1)}x`}
                  </span>
                </div>
                <input type="range" min={1} max={10} step={0.5} value={markup}
                  onChange={e => setMarkup(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer', marginBottom: 6 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray)' }}>
                  <span>1x</span><span>5x</span><span>10x</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 10, padding: '16px 20px', marginBottom: 22,
              }}>
                <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 12 }}>
                  EXEMPLO PRÁTICO
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 2 }}>Material custa</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--dark)' }}>R$ 100,00</div>
                  </div>
                  <div style={{ color: 'var(--gold)', fontSize: 24, fontWeight: 700 }}>→</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 2 }}>Preço de venda</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                      R$ {(100 * markup).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={() => go(2)}>← Voltar</button>
                <button className="btn btn-gold" disabled={loading}
                  onClick={async () => { const ok = await saveStep3(); if (ok) go(4) }}>
                  {loading ? 'Salvando...' : 'Continuar →'}
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: Materiais ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 600, marginBottom: 4 }}>
                Primeiros materiais
              </h2>
              <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 22 }}>
                Informe o custo de cada material para gerar orçamentos precisos
              </p>

              {loadingMateriais ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray)', fontSize: 13 }}>
                  Carregando materiais...
                </div>
              ) : (
                <>
                  {materiais.length > 0 && (
                    <div style={{
                      background: 'rgba(39,174,96,0.07)', border: '1px solid rgba(39,174,96,0.2)',
                      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 13, color: '#1a6e3c' }}>
                        Sua biblioteca tem{' '}
                        <strong>{materiais.length} {materiais.length === 1 ? 'material' : 'materiais'} cadastrados</strong>
                      </span>
                    </div>
                  )}

                  <div style={{
                    fontSize: 11, color: 'var(--gray)', fontWeight: 600,
                    letterSpacing: 0.5, marginBottom: 10,
                  }}>
                    CUSTO DO MATERIAL (R$/m²)
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {materiais.map(m => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: 'var(--marble)', borderRadius: 8, padding: '10px 14px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.nome}
                          </div>
                          {m.tipo && (
                            <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 1 }}>{m.tipo}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--gray)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          R$/{m.unidade}
                        </span>
                        <input
                          type="number" min={0} step={1}
                          value={precos[m.id] ?? 0}
                          onChange={e => setPrecos(p => ({ ...p, [m.id]: parseFloat(e.target.value) || 0 }))}
                          style={{
                            width: 96, padding: '7px 10px', flexShrink: 0,
                            border: '1.5px solid var(--marble2)', borderRadius: 6,
                            fontSize: 13, textAlign: 'right',
                            fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border 0.2s',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--marble2)')}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 24, lineHeight: 1.6 }}>
                    💡 Você pode adicionar mais materiais e ajustar preços a qualquer momento em <strong>Insumos</strong>.
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={() => go(3)}>← Voltar</button>
                <button
                  className="btn btn-gold"
                  disabled={loading || loadingMateriais}
                  onClick={conclude}
                  style={{ fontWeight: 600 }}
                >
                  {loading ? 'Concluindo...' : '🎉 Concluir setup'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray)', marginTop: 16 }}>
          Você pode editar essas informações depois em Configurações
        </p>
      </div>
    </div>
  )
}

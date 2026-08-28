'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Funcionario {
  id: string
  nome: string
  cargo: 'serrador' | 'acabador' | 'instalador' | 'medidor' | 'outro'
  tipo_pagamento: 'diaria' | 'metro_linear'
  valor_diaria: number | null
  valor_metro_linear: number | null
  telefone: string | null
  ativo: boolean
}

interface Presenca {
  id: string
  funcionario_id: string
  data: string
  presente: boolean
  valor_diaria: number
}

interface Instalacao {
  id: string
  funcionario_id: string
  ordem_servico_id: string | null
  data: string
  metros_lineares: number
  valor_metro_linear: number
  valor_total: number
  funcionarios: { id: string; nome: string } | null
}

interface Pagamento {
  id: string
  funcionario_id: string
  tipo: 'pagamento' | 'adiantamento' | 'desconto'
  valor: number
  data: string
  descricao: string | null
  semana_referencia: string | null
  funcionarios: { id: string; nome: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function apiFetch(url: string, init?: RequestInit) {
  return fetch(url, { credentials: 'include', ...init })
}

function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getWeekDays(monday: string): string[] {
  const days: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday + 'T12:00:00')
    d.setDate(d.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtWeekLabel(monday: string): string {
  const days = getWeekDays(monday)
  return `${fmtDate(days[0])} – ${fmtDate(days[5])}`
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CARGO_LABELS: Record<string, string> = {
  serrador: 'Serrador',
  acabador: 'Acabador',
  instalador: 'Instalador',
  medidor: 'Medidor',
  outro: 'Outro',
}

// ─── Week Selector ────────────────────────────────────────────────────────────

function WeekSelector({ semana, onChange }: { semana: string; onChange: (s: string) => void }) {
  function prev() {
    const d = new Date(semana + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    onChange(d.toISOString().split('T')[0])
  }
  function next() {
    const d = new Date(semana + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    onChange(d.toISOString().split('T')[0])
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn btn-outline btn-sm" onClick={prev}>‹ Anterior</button>
      <span style={{ fontWeight: 600, fontSize: 14, minWidth: 120, textAlign: 'center' }}>
        {fmtWeekLabel(semana)}
      </span>
      <button className="btn btn-outline btn-sm" onClick={next}>Próxima ›</button>
    </div>
  )
}

// ─── Sub-aba: Presença Semanal ────────────────────────────────────────────────

function AbaPresenca({ funcionarios }: { funcionarios: Funcionario[] }) {
  const { toast } = useApp()
  const [semana, setSemana] = useState(getMondayOfWeek)
  const [presencas, setPresencas] = useState<Presenca[]>([])
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [showRelatorio, setShowRelatorio] = useState(false)

  const naoInstaladores = funcionarios.filter(f => f.ativo && f.cargo !== 'instalador')
  const dias = getWeekDays(semana)

  const loadPresencas = useCallback(async () => {
    const res = await apiFetch(`/api/funcionarios/presencas?semana=${semana}`)
    if (res.ok) setPresencas(await res.json())
  }, [semana])

  useEffect(() => { loadPresencas() }, [loadPresencas])

  function isPresente(funcId: string, dia: string): boolean {
    return presencas.some(p => p.funcionario_id === funcId && p.data === dia && p.presente)
  }

  async function togglePresenca(func: Funcionario, dia: string) {
    const key = `${func.id}-${dia}`
    if (saving.has(key)) return
    setSaving(prev => new Set(prev).add(key))

    const novoValor = !isPresente(func.id, dia)
    const res = await apiFetch('/api/funcionarios/presencas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_id: func.id,
        data: dia,
        presente: novoValor,
        valor_diaria: func.valor_diaria ?? 0,
      }),
    })

    if (res.ok) {
      const updated: Presenca = await res.json()
      setPresencas(prev => {
        const filtered = prev.filter(p => !(p.funcionario_id === func.id && p.data === dia))
        return [...filtered, updated]
      })
    } else {
      toast('Erro ao registrar presença', 'err')
    }

    setSaving(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  function diasPresentes(funcId: string): number {
    return dias.filter(d => isPresente(funcId, d)).length
  }

  function valorAReceber(func: Funcionario): number {
    return diasPresentes(func.id) * (func.valor_diaria ?? 0)
  }

  const totalDias = naoInstaladores.reduce((acc, f) => acc + diasPresentes(f.id), 0)
  const totalValor = naoInstaladores.reduce((acc, f) => acc + valorAReceber(f), 0)

  // ── Relatório ──
  function gerarRelatorio(): string {
    const lines: string[] = [
      `RELATÓRIO SEMANAL DE PRESENÇA`,
      `Semana: ${fmtWeekLabel(semana)}`,
      ``,
      `FUNCIONÁRIOS (DIÁRIA)`,
      `${'Nome'.padEnd(20)} ${'Dias'.padStart(4)} ${'Valor'.padStart(10)}`,
      `${'─'.repeat(36)}`,
    ]
    for (const f of naoInstaladores) {
      const dias_ = diasPresentes(f.id)
      const val = valorAReceber(f)
      lines.push(`${f.nome.padEnd(20)} ${String(dias_).padStart(4)} ${fmt(val).padStart(10)}`)
    }
    lines.push(`${'─'.repeat(36)}`)
    lines.push(`${'TOTAL'.padEnd(20)} ${String(totalDias).padStart(4)} ${fmt(totalValor).padStart(10)}`)
    return lines.join('\n')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray2)' }}>
        <WeekSelector semana={semana} onChange={setSemana} />
        <button className="btn btn-outline btn-sm" onClick={() => setShowRelatorio(true)}>
          📋 Gerar Relatório
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Cargo</th>
              {dias.map((d, i) => (
                <th key={d} style={{ textAlign: 'center', minWidth: 52 }}>
                  <div style={{ fontWeight: 700 }}>{DAY_LABELS[i]}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 400 }}>{fmtDate(d)}</div>
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>Dias</th>
              <th style={{ textAlign: 'right' }}>A Receber</th>
            </tr>
          </thead>
          <tbody>
            {naoInstaladores.length === 0 ? (
              <tr><td colSpan={11}><div className="empty-state"><h3>Nenhum funcionário ativo (exceto instaladores)</h3></div></td></tr>
            ) : naoInstaladores.map(func => (
              <tr key={func.id}>
                <td style={{ fontWeight: 500 }}>{func.nome}</td>
                <td className="text-sm text-gray">{CARGO_LABELS[func.cargo]}</td>
                {dias.map(dia => {
                  const key = `${func.id}-${dia}`
                  const presente = isPresente(func.id, dia)
                  const busy = saving.has(key)
                  return (
                    <td key={dia} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={presente}
                        disabled={busy}
                        onChange={() => togglePresenca(func, dia)}
                        style={{ width: 18, height: 18, cursor: busy ? 'wait' : 'pointer', accentColor: 'var(--gold)' }}
                      />
                    </td>
                  )
                })}
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{diasPresentes(func.id)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>{fmt(valorAReceber(func))}</td>
              </tr>
            ))}
          </tbody>
          {naoInstaladores.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--light)', fontWeight: 700 }}>
                <td colSpan={2}>TOTAL</td>
                {dias.map(d => <td key={d} />)}
                <td style={{ textAlign: 'center' }}>{totalDias}</td>
                <td style={{ textAlign: 'right', color: 'var(--gold)' }}>{fmt(totalValor)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showRelatorio && (
        <div className="modal-overlay open" style={{ zIndex: 9000 }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Relatório Semanal — {fmtWeekLabel(semana)}</div>
              <button className="btn-close" onClick={() => setShowRelatorio(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <pre style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--light)', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {gerarRelatorio()}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(gerarRelatorio()); toast('Copiado!', 'ok2') }}>
                📋 Copiar
              </button>
              <button className="btn btn-gold" onClick={() => window.print()}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-aba: Instalações ─────────────────────────────────────────────────────

function AbaInstalacoes({ funcionarios }: { funcionarios: Funcionario[] }) {
  const { toast, orcamentos } = useApp()
  const [semana, setSemana] = useState(getMondayOfWeek)
  const [instalacoes, setInstalacoes] = useState<Instalacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    funcionario_id: '',
    ordem_servico_id: '',
    data: new Date().toISOString().split('T')[0],
    metros_lineares: '',
    valor_metro_linear: '',
  })
  const [saving, setSaving] = useState(false)

  const instaladores = funcionarios.filter(f => f.ativo && f.cargo === 'instalador')

  const loadInstalacoes = useCallback(async () => {
    const res = await apiFetch(`/api/funcionarios/instalacoes?semana=${semana}`)
    if (res.ok) setInstalacoes(await res.json())
  }, [semana])

  useEffect(() => { loadInstalacoes() }, [loadInstalacoes])

  function up(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleInstaladorChange(id: string) {
    const inst = instaladores.find(f => f.id === id)
    setForm(f => ({ ...f, funcionario_id: id, valor_metro_linear: String(inst?.valor_metro_linear ?? '') }))
  }

  const totalCalc = (parseFloat(form.metros_lineares) || 0) * (parseFloat(form.valor_metro_linear) || 0)

  async function salvar() {
    if (!form.funcionario_id) { toast('Selecione um instalador', 'err'); return }
    if (!form.metros_lineares || parseFloat(form.metros_lineares) <= 0) { toast('Metros inválidos', 'err'); return }
    setSaving(true)
    const res = await apiFetch('/api/funcionarios/instalacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_id: form.funcionario_id,
        ordem_servico_id: form.ordem_servico_id || null,
        data: form.data,
        metros_lineares: parseFloat(form.metros_lineares),
        valor_metro_linear: parseFloat(form.valor_metro_linear) || 0,
      }),
    })
    if (res.ok) {
      toast('Instalação registrada', 'ok2')
      setShowModal(false)
      setForm({ funcionario_id: '', ordem_servico_id: '', data: new Date().toISOString().split('T')[0], metros_lineares: '', valor_metro_linear: '' })
      loadInstalacoes()
    } else {
      const d = await res.json()
      toast(d.error || 'Erro ao salvar', 'err')
    }
    setSaving(false)
  }

  const totalMetros = instalacoes.reduce((acc, i) => acc + i.metros_lineares, 0)
  const totalValor = instalacoes.reduce((acc, i) => acc + i.valor_total, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray2)' }}>
        <WeekSelector semana={semana} onChange={setSemana} />
        <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>+ Registrar Instalação</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Instalador</th>
              <th>Orçamento</th>
              <th>Data</th>
              <th style={{ textAlign: 'right' }}>Metros (m)</th>
              <th style={{ textAlign: 'right' }}>Valor/m</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {instalacoes.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state"><h3>Nenhuma instalação nesta semana</h3></div></td></tr>
            ) : instalacoes.map(inst => {
              const orc = orcamentos.find(o => o.id === inst.ordem_servico_id)
              return (
                <tr key={inst.id}>
                  <td style={{ fontWeight: 500 }}>{inst.funcionarios?.nome ?? '—'}</td>
                  <td className="text-sm text-gray">{orc ? (orc.descricao || `Orç. #${orc.numero || orc.id.slice(0,6)}`) : (inst.ordem_servico_id ? inst.ordem_servico_id.slice(0,8) : '—')}</td>
                  <td className="text-sm">{fmtDate(inst.data)}</td>
                  <td style={{ textAlign: 'right' }}>{inst.metros_lineares.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(inst.valor_metro_linear)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>{fmt(inst.valor_total)}</td>
                </tr>
              )
            })}
          </tbody>
          {instalacoes.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--light)', fontWeight: 700 }}>
                <td colSpan={3}>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{totalMetros.toFixed(2)}</td>
                <td />
                <td style={{ textAlign: 'right', color: 'var(--gold)' }}>{fmt(totalValor)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay open" style={{ zIndex: 9000 }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">Registrar Instalação</div>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">INSTALADOR *</label>
                <select className="form-select" value={form.funcionario_id} onChange={e => handleInstaladorChange(e.target.value)}>
                  <option value="">— Selecionar —</option>
                  {instaladores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ORÇAMENTO (opcional)</label>
                <select className="form-select" value={form.ordem_servico_id} onChange={e => up('ordem_servico_id', e.target.value)}>
                  <option value="">— Nenhum —</option>
                  {orcamentos.filter(o => (o.producao_status as string) === 'instalacao').map(o => (
                    <option key={o.id} value={o.id}>{o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}</option>
                  ))}
                </select>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">DATA</label>
                  <input className="form-input" type="date" value={form.data} onChange={e => up('data', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">METROS LINEARES</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.metros_lineares} onChange={e => up('metros_lineares', e.target.value)} />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">VALOR POR METRO (R$)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.valor_metro_linear} onChange={e => up('valor_metro_linear', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">TOTAL CALCULADO</label>
                  <div className="form-input" style={{ background: 'var(--light)', fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center' }}>
                    {fmt(totalCalc)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-aba: Histórico & Pagamentos ─────────────────────────────────────────

function AbaHistorico({ funcionarios }: { funcionarios: Funcionario[] }) {
  const { toast } = useApp()
  const [funcId, setFuncId] = useState('')
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [instalacoes, setInstalacoes] = useState<Instalacao[]>([])
  const [presencas, setPresencas] = useState<Presenca[]>([])
  const [modal, setModal] = useState<{ open: boolean; tipo: 'pagamento' | 'adiantamento' | 'desconto' }>({ open: false, tipo: 'pagamento' })
  const [form, setForm] = useState({ valor: '', data: new Date().toISOString().split('T')[0], descricao: '', semana_referencia: '' })
  const [saving, setSaving] = useState(false)

  const func = funcionarios.find(f => f.id === funcId)

  const load = useCallback(async () => {
    if (!funcId) { setPagamentos([]); setInstalacoes([]); setPresencas([]); return }
    const [rPag, rIns, rPres] = await Promise.all([
      apiFetch(`/api/funcionarios/pagamentos?funcionario_id=${funcId}`),
      apiFetch(`/api/funcionarios/instalacoes?funcionario_id=${funcId}`),
      apiFetch(`/api/funcionarios/presencas?semana=${getMondayOfWeek()}`),
    ])
    if (rPag.ok) setPagamentos(await rPag.json())
    if (rIns.ok) setInstalacoes(await rIns.json())
    if (rPres.ok) {
      const all: Presenca[] = await rPres.json()
      setPresencas(all.filter(p => p.funcionario_id === funcId))
    }
  }, [funcId])

  useEffect(() => { load() }, [load])

  // Totais
  const totalDiarias = presencas.filter(p => p.presente).reduce((acc, p) => acc + p.valor_diaria, 0)
  const totalInstalacoes = instalacoes.reduce((acc, i) => acc + i.valor_total, 0)
  const totalGerado = func?.tipo_pagamento === 'metro_linear' ? totalInstalacoes : totalDiarias
  const totalAdiantamentos = pagamentos.filter(p => p.tipo === 'adiantamento').reduce((acc, p) => acc + p.valor, 0)
  const totalDescontos = pagamentos.filter(p => p.tipo === 'desconto').reduce((acc, p) => acc + p.valor, 0)
  const totalPago = pagamentos.filter(p => p.tipo === 'pagamento').reduce((acc, p) => acc + p.valor, 0)
  const saldo = totalGerado - totalAdiantamentos - totalDescontos - totalPago

  async function registrar() {
    if (!funcId) { toast('Selecione um funcionário', 'err'); return }
    if (!form.valor || parseFloat(form.valor) <= 0) { toast('Valor inválido', 'err'); return }
    setSaving(true)
    const res = await apiFetch('/api/funcionarios/pagamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_id: funcId,
        tipo: modal.tipo,
        valor: parseFloat(form.valor),
        data: form.data,
        descricao: form.descricao || null,
        semana_referencia: form.semana_referencia || null,
      }),
    })
    if (res.ok) {
      const tipoLabel = modal.tipo === 'pagamento' ? 'Pagamento' : modal.tipo === 'adiantamento' ? 'Adiantamento' : 'Desconto'
      toast(`${tipoLabel} registrado`, 'ok2')
      setModal({ open: false, tipo: 'pagamento' })
      setForm({ valor: '', data: new Date().toISOString().split('T')[0], descricao: '', semana_referencia: '' })
      load()
    } else {
      const d = await res.json()
      toast(d.error || 'Erro ao registrar', 'err')
    }
    setSaving(false)
  }

  function openModal(tipo: 'pagamento' | 'adiantamento' | 'desconto') {
    setModal({ open: true, tipo })
    setForm({ valor: '', data: new Date().toISOString().split('T')[0], descricao: '', semana_referencia: '' })
  }

  const tipoBadge = (tipo: string) => {
    if (tipo === 'pagamento') return <span className="badge badge-approved">Pagamento</span>
    if (tipo === 'adiantamento') return <span className="badge badge-pending">Adiantamento</span>
    return <span className="badge badge-rejected">Desconto</span>
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div className="form-group" style={{ marginBottom: 20, maxWidth: 300 }}>
        <label className="form-label">FUNCIONÁRIO</label>
        <select className="form-select" value={funcId} onChange={e => setFuncId(e.target.value)}>
          <option value="">— Selecionar —</option>
          {funcionarios.filter(f => f.ativo).map(f => <option key={f.id} value={f.id}>{f.nome} ({CARGO_LABELS[f.cargo]})</option>)}
        </select>
      </div>

      {funcId && (
        <>
          {/* Cards resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: func?.tipo_pagamento === 'metro_linear' ? 'Instalações (semana)' : 'Diárias (semana)', val: totalGerado, color: 'var(--gold)' },
              { label: 'Adiantamentos', val: totalAdiantamentos, color: '#E67E22' },
              { label: 'Descontos', val: totalDescontos, color: '#C0392B' },
              { label: 'Saldo', val: saldo, color: saldo >= 0 ? '#27AE60' : '#C0392B' },
            ].map(c => (
              <div key={c.label} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{fmt(c.val)}</div>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className="btn btn-gold btn-sm" onClick={() => openModal('pagamento')}>💳 Registrar Pagamento</button>
            <button className="btn btn-outline btn-sm" onClick={() => openModal('adiantamento')}>💵 Adiantamento</button>
            <button className="btn btn-outline btn-sm" onClick={() => openModal('desconto')}>✂️ Desconto</button>
          </div>

          {/* Tabela histórico */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Semana ref.</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><h3>Nenhum lançamento</h3></div></td></tr>
                ) : pagamentos.map(p => (
                  <tr key={p.id}>
                    <td className="text-sm">{p.data ? fmtDate(p.data) : '—'}</td>
                    <td>{tipoBadge(p.tipo)}</td>
                    <td className="text-sm text-gray">{p.descricao || '—'}</td>
                    <td className="text-sm text-gray">{p.semana_referencia ? fmtWeekLabel(p.semana_referencia) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!funcId && (
        <div className="empty-state"><h3>Selecione um funcionário para ver o histórico</h3></div>
      )}

      {modal.open && (
        <div className="modal-overlay open" style={{ zIndex: 9000 }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">
                {modal.tipo === 'pagamento' ? '💳 Registrar Pagamento' : modal.tipo === 'adiantamento' ? '💵 Registrar Adiantamento' : '✂️ Registrar Desconto'}
              </div>
              <button className="btn-close" onClick={() => setModal({ open: false, tipo: 'pagamento' })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">VALOR (R$) *</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">DATA</label>
                  <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">DESCRIÇÃO</label>
                <input className="form-input" placeholder="Ex: Referente à semana..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal({ open: false, tipo: 'pagamento' })}>Cancelar</button>
              <button className="btn btn-gold" onClick={registrar} disabled={saving}>{saving ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Aba = 'presenca' | 'instalacoes' | 'historico'

const ABAS: { id: Aba; label: string }[] = [
  { id: 'presenca', label: 'Presença Semanal' },
  { id: 'instalacoes', label: 'Instalações' },
  { id: 'historico', label: 'Histórico & Pagamentos' },
]

export default function FuncionariosPage() {
  const [aba, setAba] = useState<Aba>('presenca')
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  useEffect(() => {
    apiFetch('/api/funcionarios')
      .then(r => r.ok ? r.json() : [])
      .then(setFuncionarios)
  }, [])

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Funcionários</h1>
      </div>

      <div className="card" style={{ marginBottom: 0, padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray2)' }}>
          {ABAS.map(a => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                fontWeight: aba === a.id ? 700 : 400,
                borderBottom: aba === a.id ? '2px solid var(--gold)' : '2px solid transparent',
                color: aba === a.id ? 'var(--gold)' : 'var(--gray)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'presenca' && <AbaPresenca funcionarios={funcionarios} />}
        {aba === 'instalacoes' && <AbaInstalacoes funcionarios={funcionarios} />}
        {aba === 'historico' && <AbaHistorico funcionarios={funcionarios} />}
      </div>
    </div>
  )
}

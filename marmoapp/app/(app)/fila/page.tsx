'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Funcionario { id: string; nome: string; cargo: string; valor_metro_linear: number | null; ativo: boolean }

function InstalarModal({ orcId, orcLabel, instaladores, onClose, onSaved }: {
  orcId: string
  orcLabel: string
  instaladores: Funcionario[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useApp()
  const [form, setForm] = useState({
    funcionario_id: '',
    data: new Date().toISOString().split('T')[0],
    metros_lineares: '',
    valor_metro_linear: '',
  })
  const [saving, setSaving] = useState(false)

  function handleInstalador(id: string) {
    const f = instaladores.find(i => i.id === id)
    setForm(prev => ({ ...prev, funcionario_id: id, valor_metro_linear: String(f?.valor_metro_linear ?? '') }))
  }

  const total = (parseFloat(form.metros_lineares) || 0) * (parseFloat(form.valor_metro_linear) || 0)

  async function salvar() {
    if (!form.funcionario_id) { toast('Selecione um instalador', 'err'); return }
    if (!form.metros_lineares || parseFloat(form.metros_lineares) <= 0) { toast('Metros inválidos', 'err'); return }
    setSaving(true)
    const res = await fetch('/api/funcionarios/instalacoes', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_id: form.funcionario_id,
        ordem_servico_id: orcId,
        data: form.data,
        metros_lineares: parseFloat(form.metros_lineares),
        valor_metro_linear: parseFloat(form.valor_metro_linear) || 0,
      }),
    })
    if (res.ok) {
      toast('Instalação registrada', 'ok2')
      onSaved()
      onClose()
    } else {
      const d = await res.json()
      toast(d.error || 'Erro ao registrar', 'err')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Atribuir Instalador</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Orçamento: <b>{orcLabel}</b></div>
          <div className="form-group">
            <label className="form-label">INSTALADOR</label>
            <select className="form-select" value={form.funcionario_id} onChange={e => handleInstalador(e.target.value)}>
              <option value="">— Selecionar —</option>
              {instaladores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">DATA</label>
              <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">METROS LINEARES</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.metros_lineares} onChange={e => setForm(f => ({ ...f, metros_lineares: e.target.value }))} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">VALOR/METRO (R$)</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.valor_metro_linear} onChange={e => setForm(f => ({ ...f, valor_metro_linear: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">TOTAL</label>
              <div className="form-input" style={{ background: 'var(--light)', fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center' }}>{fmt(total)}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '💾 Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

const PIPELINE = [
  { id: 'comercial',         label: 'Comercial',           cor: '#2980B9' },
  { id: 'corte',             label: 'Corte',               cor: '#8E44AD' },
  { id: 'acabamento',        label: 'Acabamento',          cor: '#E67E22' },
  { id: 'aguardando_data',   label: 'Aguardando Data',     cor: '#16A085' },
  { id: 'instalacao',        label: 'Instalação Confirmada', cor: '#27AE60' },
  { id: 'finalizado',        label: 'Finalizado',          cor: '#2C3E50' },
]

const FILA_TO_ETAPA: Record<string, string> = {
  corte: 'producao',
  aguardando_data: 'pronto',
  instalacao: 'agendado',
  finalizado: 'concluido',
}

export default function FilaPage() {
  const { orcamentos, clientes, loadOrcamentos, toast } = useApp()
  const [instaladores, setInstaladores] = useState<Funcionario[]>([])
  const [instalarModal, setInstalarModal] = useState<{ open: boolean; orcId: string; orcLabel: string }>({ open: false, orcId: '', orcLabel: '' })
  const [projetoMap, setProjetoMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/funcionarios', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Funcionario[]) => setInstaladores(data.filter(f => f.ativo && f.cargo === 'instalador')))
    fetch('/api/projetos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; orcamento_id?: string | null }[]) => {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.orcamento_id) map[p.orcamento_id] = p.id })
        setProjetoMap(map)
      })
  }, [])

  const ativos = orcamentos.filter(o => o.crm_status === 'fechado' || o.producao_status)

  async function avancar(orcId: string, novoStatus: string) {
    const { error } = await supabase.from('orcamentos').update({ producao_status: novoStatus }).eq('id', orcId)
    if (error) { toast('Erro: ' + error.message, 'err'); return }
    const etapa = FILA_TO_ETAPA[novoStatus]
    const projetoId = projetoMap[orcId]
    if (etapa && projetoId) {
      fetch(`/api/projetos/${projetoId}/etapas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa }),
      })
    }
    await loadOrcamentos()
    toast('Pedido avançado!', 'ok2')
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Fila de Serviços</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0', minHeight: 400 }}>
        {PIPELINE.map((etapa, idx) => {
          const cards = ativos.filter(o => (o.producao_status || 'comercial') === etapa.id)
          const proxEtapa = idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null

          return (
            <div key={etapa.id} style={{ minWidth: 200, flex: 1, background: '#f7f7f7', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: etapa.cor, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{etapa.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {cards.length}
                </span>
              </div>

              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#ccc', fontSize: 12 }}>Nenhum pedido</div>
                ) : cards.map(o => {
                  const cli = clientes.find(c => c.id === (o.clienteId || o.cliente_id))
                  const totalVal = orcTotal(o)
                  return (
                    <div key={o.id} style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${etapa.cor}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
                        {o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{cli?.nome || '—'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: etapa.cor, marginBottom: 8 }}>{fmt(totalVal)}</div>
                      {etapa.id === 'instalacao' && (
                        <button
                          onClick={() => setInstalarModal({ open: true, orcId: o.id, orcLabel: o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}` })}
                          style={{ width: '100%', background: '#16A085', border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
                        >
                          👷 Atribuir Instalador
                        </button>
                      )}
                      {proxEtapa ? (
                        <button
                          onClick={() => avancar(o.id, proxEtapa.id)}
                          style={{ width: '100%', background: etapa.cor, border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          → {proxEtapa.label}
                        </button>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#27AE60', fontWeight: 700 }}>✅ Concluído</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {instalarModal.open && (
        <InstalarModal
          orcId={instalarModal.orcId}
          orcLabel={instalarModal.orcLabel}
          instaladores={instaladores}
          onClose={() => setInstalarModal({ open: false, orcId: '', orcLabel: '' })}
          onSaved={loadOrcamentos}
        />
      )}
    </div>
  )
}

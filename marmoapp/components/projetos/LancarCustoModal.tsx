'use client'

import { useState, useEffect } from 'react'
import type { CustoTipo } from '@/lib/projetos/types'

const TIPOS: { value: CustoTipo; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'mao_obra', label: 'Mão de Obra' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'outros', label: 'Outros' },
]

interface Funcionario { id: string; nome: string; ativo: boolean }

interface Props {
  projectId: string
  onClose: () => void
  onSaved: () => void
  toast: (msg: string, type?: 'ok' | 'err' | 'ok2') => void
}

export default function LancarCustoModal({ projectId, onClose, onSaved, toast }: Props) {
  const [saving, setSaving] = useState(false)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [form, setForm] = useState({
    tipo: 'material' as CustoTipo,
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    funcionario_id: '',
  })

  useEffect(() => {
    fetch('/api/funcionarios', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Funcionario[]) => setFuncionarios(data.filter(f => f.ativo)))
  }, [])

  async function salvar() {
    if (!form.descricao.trim()) { toast('Descrição obrigatória', 'err'); return }
    if (!form.valor || parseFloat(form.valor) <= 0) { toast('Valor deve ser maior que zero', 'err'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/custos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: form.tipo,
          descricao: form.descricao.trim(),
          valor: parseFloat(form.valor),
          data: form.data,
          funcionario_id: form.funcionario_id || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast('Custo lançado', 'ok')
      onSaved()
      onClose()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 440, marginTop: 60 }}>
        <div className="modal-header">
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600 }}>Lançar Custo</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Categoria</label>
            <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as CustoTipo }))}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descrição *</label>
            <input className="form-control" value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Granito Branco Siena 2 chapas" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor (R$) *</label>
              <input className="form-control" type="number" min="0" step="0.01" value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data</label>
              <input className="form-control" type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          {funcionarios.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Funcionário (opcional)</label>
              <select className="form-control" value={form.funcionario_id}
                onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}>
                <option value="">— Nenhum —</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn-gold" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Lançar custo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProjectCostType, CreateProjectCostInput } from '@/lib/projetos/types'

interface Props {
  projectId: string
  tipos: ProjectCostType[]
  onClose: () => void
  onSaved: () => void
  toast: (msg: string, type?: 'ok' | 'err' | 'ok2') => void
}

export default function LancarCustoModal({ projectId, tipos, onClose, onSaved, toast }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateProjectCostInput>({
    tipo_id: tipos[0]?.id ?? '',
    descricao: '',
    valor: 0,
    data: new Date().toISOString().split('T')[0],
  })

  const set = <K extends keyof CreateProjectCostInput>(k: K, v: CreateProjectCostInput[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  async function salvar() {
    if (!form.descricao.trim()) { toast('Descrição obrigatória', 'err'); return }
    if (!form.valor || form.valor <= 0) { toast('Valor deve ser maior que zero', 'err'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/projetos/${projectId}/custos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          tipo_id: form.tipo_id || undefined,
          descricao: form.descricao.trim(),
          valor: Number(form.valor),
          data: form.data,
        } satisfies CreateProjectCostInput),
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
            <select className="form-control" value={form.tipo_id} onChange={e => set('tipo_id', e.target.value)}>
              <option value="">— Sem categoria —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descrição *</label>
            <input className="form-control" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Granito Branco Siena 2 chapas" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor (R$) *</label>
              <input className="form-control" type="number" min="0" step="0.01" value={form.valor}
                onChange={e => set('valor', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data</label>
              <input className="form-control" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
          </div>
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

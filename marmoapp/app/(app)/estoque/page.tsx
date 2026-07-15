'use client'

import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt, sbSave } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Material } from '@/lib/types'

function MaterialModal({
  material, marmorariaId, onClose, onSaved,
}: {
  material: Material | null
  marmorariaId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: material?.nome || '',
    tipo: material?.tipo || '',
    unidade: material?.unidade || 'm²',
    custo_unitario: String(material?.custo_unitario || ''),
    preco_venda: String(material?.preco_venda || material?.preco_unitario || material?.preco || ''),
    estoque_atual: String(material?.estoque_atual || ''),
    estoque_minimo: String(material?.estoque_minimo || ''),
    fornecedor: material?.fornecedor || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.nome) { setError('Nome é obrigatório'); return }
    try {
      setLoading(true)
      setError('')
      const precoVenda = parseFloat(form.preco_venda) || 0
      const payload = {
        nome: form.nome,
        tipo: form.tipo,
        unidade: form.unidade,
        fornecedor: form.fornecedor,
        marmoraria_id: marmorariaId,
        custo_unitario: parseFloat(form.custo_unitario) || 0,
        preco_venda: precoVenda,
        preco_unitario: precoVenda,
        estoque_atual: parseFloat(form.estoque_atual) || 0,
        estoque_minimo: parseFloat(form.estoque_minimo) || 0,
      }
      const { error: err } = await sbSave(
        material
          ? supabase.from('materiais').update(payload).eq('id', material.id)
          : supabase.from('materiais').insert(payload)
      )
      if (err) throw err
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar material:', err)
      setError(err?.message || 'Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{material ? 'Editar Material' : 'Novo Material'}</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">NOME *</label>
              <input className="form-input" placeholder="Ex: Mármore Branco" value={form.nome} onChange={e => up('nome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">TIPO</label>
              <input className="form-input" placeholder="Ex: Mármore, Granito" value={form.tipo} onChange={e => up('tipo', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">UNIDADE</label>
            <select className="form-select" value={form.unidade} onChange={e => up('unidade', e.target.value)}>
              <option value="m²">m²</option>
              <option value="m">m linear</option>
              <option value="un">unidade</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">VALOR DE COMPRA (R$)</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.custo_unitario} onChange={e => up('custo_unitario', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gray)', marginTop: 3, display: 'block' }}>Quanto você paga ao fornecedor por {form.unidade}</span>
            </div>
            <div className="form-group">
              <label className="form-label">VALOR DE VENDA (R$)</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.preco_venda} onChange={e => up('preco_venda', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gray)', marginTop: 3, display: 'block' }}>Quanto você cobra do cliente por {form.unidade}</span>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">ESTOQUE ATUAL</label>
              <input className="form-input" type="number" step="0.01" placeholder="0" value={form.estoque_atual} onChange={e => up('estoque_atual', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ESTOQUE MÍNIMO</label>
              <input className="form-input" type="number" step="0.01" placeholder="0" value={form.estoque_minimo} onChange={e => up('estoque_minimo', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">FORNECEDOR</label>
            <input className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e => up('fornecedor', e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={save} disabled={loading}>{loading ? 'Salvando...' : '💾 Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function EstoquePage() {
  const { materiais, marmoraria, loadMateriais, toast } = useApp()
  const [modal, setModal] = useState<{ open: boolean; material: Material | null }>({ open: false, material: null })
  const [query, setQuery] = useState('')

  const filtered = materiais.filter(m => !query || m.nome.toLowerCase().includes(query.toLowerCase()))

  async function excluir(id: string) {
    if (!confirm('Excluir este material?')) return
    await supabase.from('materiais').delete().eq('id', id)
    await loadMateriais()
    toast('Material excluído', 'ok2')
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Estoque</h1>
        <button className="btn btn-gold" onClick={() => setModal({ open: true, material: null })}>+ Novo Material</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Materiais em Estoque</span>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="form-input" style={{ width: 220, paddingLeft: 32 }} placeholder="Buscar..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Unidade</th><th>Preço/Un</th><th>Estoque</th><th>Mínimo</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><h3>Nenhum material</h3></div></td></tr>
              ) : filtered.map(m => {
                const abaixo = (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0)
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.nome}</td>
                    <td className="text-gray text-sm">{m.tipo || '—'}</td>
                    <td className="text-sm">{m.unidade}</td>
                    <td className="font-bold">{fmt(m.preco_unitario || m.preco || 0)}</td>
                    <td className="text-sm">{m.estoque_atual ?? '—'}</td>
                    <td className="text-sm">{m.estoque_minimo ?? '—'}</td>
                    <td>
                      <span className={`badge ${abaixo ? 'badge-rejected' : 'badge-approved'}`}>
                        {abaixo ? '⚠️ Baixo' : '✅ OK'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ open: true, material: m })}>✏️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => excluir(m.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && marmoraria && (
        <MaterialModal
          material={modal.material}
          marmorariaId={marmoraria.id}
          onClose={() => setModal({ open: false, material: null })}
          onSaved={loadMateriais}
        />
      )}
    </div>
  )
}

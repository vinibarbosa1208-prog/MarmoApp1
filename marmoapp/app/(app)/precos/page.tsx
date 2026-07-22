'use client'

import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt, sbSave } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Material, Servico } from '@/lib/types'

type Tab = 'materiais' | 'servicos'

export default function PrecosPage() {
  const { materiais, servicos, marmoraria, loadMateriais, loadServicos, toast } = useApp()
  const [tab, setTab] = useState<Tab>('materiais')
  const [query, setQuery] = useState('')
  const [editingMatId, setEditingMatId] = useState<string | null>(null)
  const [editingMatPreco, setEditingMatPreco] = useState('')
  const [editingSrvId, setEditingSrvId] = useState<string | null>(null)
  const [editingSrvPreco, setEditingSrvPreco] = useState('')
  const [showNovoMat, setShowNovoMat] = useState(false)
  const [showNovoSrv, setShowNovoSrv] = useState(false)
  const [novoMat, setNovoMat] = useState({ nome: '', unidade: 'm²', preco_padrao: '' })
  const [novoSrv, setNovoSrv] = useState({ nome: '', descricao: '', preco_padrao: '' })
  const [savingMat, setSavingMat] = useState(false)

  const mats = materiais.filter(m => !query || m.nome.toLowerCase().includes(query.toLowerCase()))
  const srvs = servicos.filter(s => !query || s.nome.toLowerCase().includes(query.toLowerCase()))

  async function salvarPrecoMat(id: string) {
    try {
      const preco = parseFloat(editingMatPreco)
      const { error } = await sbSave(supabase.from('materiais').update({ preco_padrao: preco }).eq('id', id))
      if (error) throw error
      setEditingMatId(null)
      await loadMateriais()
      toast('Preço atualizado', 'ok2')
    } catch (err: any) {
      toast(err?.message || 'Erro ao atualizar preço', 'err')
    }
  }

  async function salvarPrecoSrv(id: string) {
    try {
      const preco = parseFloat(editingSrvPreco)
      const { error } = await sbSave(supabase.from('servicos').update({ preco_padrao: preco }).eq('id', id))
      if (error) throw error
      setEditingSrvId(null)
      await loadServicos()
      toast('Preço atualizado', 'ok2')
    } catch (err: any) {
      toast(err?.message || 'Erro ao atualizar preço', 'err')
    }
  }

  async function adicionarMaterial() {
    if (!novoMat.nome || !marmoraria) return
    try {
      setSavingMat(true)
      const { error } = await sbSave(supabase.from('materiais').insert({
        marmoraria_id: marmoraria.id,
        nome: novoMat.nome,
        unidade: novoMat.unidade,
        preco_padrao: parseFloat(novoMat.preco_padrao) || 0,
      }))
      if (error) throw error
      setNovoMat({ nome: '', unidade: 'm²', preco_padrao: '' })
      setShowNovoMat(false)
      await loadMateriais()
      toast('Material adicionado', 'ok2')
    } catch (err: unknown) {
      toast((err as Error)?.message || 'Erro ao salvar material', 'err')
    } finally {
      setSavingMat(false)
    }
  }

  async function adicionarServico() {
    if (!novoSrv.nome || !marmoraria) return
    try {
      const { error } = await sbSave(supabase.from('servicos').insert({
        marmoraria_id: marmoraria.id,
        nome: novoSrv.nome,
        descricao: novoSrv.descricao,
        preco_padrao: parseFloat(novoSrv.preco_padrao) || 0,
      }))
      if (error) throw error
      setNovoSrv({ nome: '', descricao: '', preco_padrao: '' })
      setShowNovoSrv(false)
      await loadServicos()
      toast('Serviço adicionado', 'ok2')
    } catch (err: any) {
      toast(err?.message || 'Erro ao salvar serviço', 'err')
    }
  }

  async function excluirMat(id: string) {
    if (!confirm('Excluir este material?')) return
    await supabase.from('materiais').delete().eq('id', id)
    await loadMateriais()
    toast('Excluído', 'ok2')
  }

  async function excluirSrv(id: string) {
    if (!confirm('Excluir este serviço?')) return
    await supabase.from('servicos').delete().eq('id', id)
    await loadServicos()
    toast('Excluído', 'ok2')
  }

  const tabStyle = (active: boolean) => ({
    padding: '12px 28px', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
    background: 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
    marginBottom: -2,
  } as React.CSSProperties)

  const countBadge = (n: number, active: boolean) => ({
    background: active ? 'rgba(201,168,76,0.15)' : 'var(--page-bg)',
    color: active ? 'var(--gold)' : 'var(--text-muted)',
    fontSize: 11, padding: '2px 8px', borderRadius: 20, marginLeft: 6,
    border: active ? '1px solid rgba(201,168,76,0.25)' : '1px solid var(--card-border)',
  } as React.CSSProperties)

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Preços e Serviços</h1>
        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input" style={{ width: 220, paddingLeft: 32 }} placeholder="Buscar..."
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--divider)', display: 'flex', padding: '0 4px' }}>
          <button style={tabStyle(tab === 'materiais')} onClick={() => setTab('materiais')}>
            🪨 Materiais <span style={countBadge(materiais.length, tab === 'materiais')}>{materiais.length}</span>
          </button>
          <button style={tabStyle(tab === 'servicos')} onClick={() => setTab('servicos')}>
            🔧 Serviços <span style={countBadge(servicos.length, tab === 'servicos')}>{servicos.length}</span>
          </button>
        </div>

        {tab === 'materiais' && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, paddingRight: 0 }}>
              <button className="btn btn-gold" onClick={() => setShowNovoMat(true)}>+ Novo Material</button>
            </div>

            {showNovoMat && (
              <div style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">NOME</label>
                  <input className="form-input" placeholder="Ex: Mármore Branco" value={novoMat.nome} onChange={e => setNovoMat(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">UNIDADE</label>
                  <select className="form-select" value={novoMat.unidade} onChange={e => setNovoMat(f => ({ ...f, unidade: e.target.value }))}>
                    <option value="m²">m²</option><option value="m">m</option><option value="un">un</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">PREÇO (R$)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={novoMat.preco_padrao} onChange={e => setNovoMat(f => ({ ...f, preco_padrao: e.target.value }))} />
                </div>
                <button className="btn btn-gold" onClick={adicionarMaterial} disabled={savingMat}>{savingMat ? 'Salvando...' : 'Salvar'}</button>
                <button className="btn btn-outline" onClick={() => setShowNovoMat(false)} disabled={savingMat}>Cancelar</button>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>MATERIAL</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>UNIDADE</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>PREÇO PADRÃO</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {mats.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Nenhum material cadastrado</td></tr>
                ) : mats.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{m.nome}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{m.unidade}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {editingMatId === m.id ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <input type="number" step="0.01" value={editingMatPreco}
                            onChange={e => setEditingMatPreco(e.target.value)}
                            style={{ width: 100, padding: '6px 10px', border: '1.5px solid var(--gold)', borderRadius: 8, fontSize: 13, textAlign: 'right', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none' }}
                            autoFocus onKeyDown={e => e.key === 'Enter' && salvarPrecoMat(m.id)} />
                          <button className="btn btn-gold btn-sm" onClick={() => salvarPrecoMat(m.id)}>✓</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingMatId(null)}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingMatId(m.id); setEditingMatPreco(String(m.preco_padrao || m.preco || 0)) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--text)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {fmt(m.preco_padrao || m.preco || 0)} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>✏️</span>
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => excluirMat(m.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'servicos' && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-gold" onClick={() => setShowNovoSrv(true)}>+ Novo Serviço</button>
            </div>

            {showNovoSrv && (
              <div style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">NOME</label>
                  <input className="form-input" placeholder="Ex: Corte de mármore" value={novoSrv.nome} onChange={e => setNovoSrv(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">DESCRIÇÃO</label>
                  <input className="form-input" placeholder="Descrição do serviço" value={novoSrv.descricao} onChange={e => setNovoSrv(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">PREÇO (R$)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={novoSrv.preco_padrao} onChange={e => setNovoSrv(f => ({ ...f, preco_padrao: e.target.value }))} />
                </div>
                <button className="btn btn-gold" onClick={adicionarServico}>Salvar</button>
                <button className="btn btn-outline" onClick={() => setShowNovoSrv(false)}>Cancelar</button>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>SERVIÇO</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>DESCRIÇÃO</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--divider)', letterSpacing: '0.4px' }}>PREÇO PADRÃO</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {srvs.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Nenhum serviço cadastrado</td></tr>
                ) : srvs.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{s.nome}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{s.descricao || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {editingSrvId === s.id ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <input type="number" step="0.01" value={editingSrvPreco}
                            onChange={e => setEditingSrvPreco(e.target.value)}
                            style={{ width: 100, padding: '6px 10px', border: '1.5px solid var(--gold)', borderRadius: 8, fontSize: 13, textAlign: 'right', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none' }}
                            autoFocus onKeyDown={e => e.key === 'Enter' && salvarPrecoSrv(s.id)} />
                          <button className="btn btn-gold btn-sm" onClick={() => salvarPrecoSrv(s.id)}>✓</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingSrvId(null)}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingSrvId(s.id); setEditingSrvPreco(String(s.preco_padrao || 0)) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--text)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {fmt(s.preco_padrao || 0)} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>✏️</span>
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => excluirSrv(s.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

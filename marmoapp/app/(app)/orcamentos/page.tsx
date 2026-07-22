'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Orcamento } from '@/lib/types'

const STATUS_BADGE: Record<string, [string, string]> = {
  rascunho: ['badge-draft', 'Rascunho'], enviado: ['badge-sent', 'Enviado'],
  aprovado: ['badge-approved', 'Aprovado'], recusado: ['badge-rejected', 'Recusado'],
  expired: ['badge-expired', 'Expirado'],
}
const CRM_COLORS: Record<string, string> = {
  novo: '#888', enviado: '#3498DB', visualizado: '#9B59B6',
  em_negociacao: '#E67E22', fechado: '#27AE60', perdido: '#C0392B',
}
const CRM_LABELS: Record<string, string> = {
  novo: 'Novo', enviado: 'Enviado', visualizado: 'Visualizado',
  em_negociacao: 'Em negociação', fechado: 'Fechado', perdido: 'Perdido',
}

function StatusBadge({ status }: { status: string }) {
  const [cls, lbl] = STATUS_BADGE[status] || ['badge-draft', status]
  return <span className={`badge ${cls}`}>{lbl}</span>
}

function ModalConfirmarExclusao({ numero, onConfirm, onCancel, busy }: {
  numero: string; onConfirm: () => void; onCancel: () => void; busy: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'Playfair Display', serif", fontSize: 20 }}>Excluir orçamento</h3>
        <p style={{ color: 'var(--gray)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Tem certeza que deseja excluir o orçamento <strong>{numero}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="btn" onClick={onConfirm} disabled={busy}
            style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
            {busy ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrcamentosPage() {
  const { orcamentos, clientes, loadOrcamentos, toast } = useApp()
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; numero: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [projetoMap, setProjetoMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/projetos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; orcamento_id?: string | null }[]) => {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.orcamento_id) map[p.orcamento_id] = p.id })
        setProjetoMap(map)
      })
  }, [])

  function clienteNome(id?: string) {
    if (!id) return '—'
    return clientes.find(c => c.id === id)?.nome || '—'
  }

  const filtered = orcamentos.filter(o => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      (o.descricao || '').toLowerCase().includes(q) ||
      clienteNome(o.clienteId || o.cliente_id).toLowerCase().includes(q)
    )
  })

  async function atualizarCRM(id: string, crmStatus: string) {
    await supabase.from('orcamentos').update({ crm_status: crmStatus }).eq('id', id)
    await loadOrcamentos()
  }

  async function cycleStatus(o: Orcamento) {
    const cycle = ['rascunho', 'enviado', 'aprovado', 'recusado'] as const
    const idx = cycle.indexOf(o.status as typeof cycle[number])
    const newStatus = cycle[(idx + 1) % cycle.length]
    await supabase.from('orcamentos').update({ status: newStatus }).eq('id', o.id)
    await loadOrcamentos()
    toast(`Status: ${newStatus}`, 'ok2')
  }

  async function excluirOrcamento() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/orcamentos/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      toast('Orçamento excluído', 'ok2')
      setDeleteTarget(null)
      await loadOrcamentos()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'err')
    } finally {
      setDeleting(false)
    }
  }

  function enviarWhatsApp(o: Orcamento) {
    const cli = clientes.find(c => c.id === (o.clienteId || o.cliente_id))
    const nome = cli?.nome?.split(' ')[0] || 'cliente'
    const total = orcTotal(o)
    let msg = `Olá ${nome}! 😊\n\nSeu orçamento está disponível!\n\n`
    msg += `💰 Total: ${fmt(total)}\n`
    msg += '\nQualquer dúvida, estou à disposição!'
    const tel = (cli?.telefone || '').replace(/\D/g, '')
    const wa = `https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(msg)}`
    window.open(wa, '_blank')
  }

  return (
    <div className="page-inner">
      {deleteTarget && (
        <ModalConfirmarExclusao
          numero={deleteTarget.numero}
          onConfirm={excluirOrcamento}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
      <div className="page-header">
        <h1 className="page-title">Orçamentos</h1>
        <Link href="/orcamentos/novo" className="btn btn-gold">+ Novo Orçamento</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos os Orçamentos</span>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              style={{ width: 220, paddingLeft: 32 }}
              placeholder="Buscar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Descrição</th><th>Cliente</th><th>Total</th>
                <th>Status</th><th>CRM</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><h3>Nenhum orçamento</h3><p>Crie seu primeiro orçamento</p></div></td></tr>
              ) : filtered.map(o => {
                const crmStatus = o.crm_status || 'novo'
                const projetoId = projetoMap[o.id]
                return (
                  <tr key={o.id}>
                    <td className="text-gray text-sm">#{o.numero || o.id.slice(0, 6)}</td>
                    <td style={{ fontWeight: 500, maxWidth: 200 }}>{o.descricao || `Orçamento`}</td>
                    <td className="text-gray">{clienteNome(o.clienteId || o.cliente_id)}</td>
                    <td className="font-bold">{fmt(orcTotal(o))}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <select
                        value={crmStatus}
                        onChange={e => atualizarCRM(o.id, e.target.value)}
                        style={{
                          background: '#fff', border: `1.5px solid ${CRM_COLORS[crmStatus] || 'var(--divider)'}`,
                          color: CRM_COLORS[crmStatus] || '#888', borderRadius: 6,
                          padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {Object.entries(CRM_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" title="WhatsApp" onClick={() => enviarWhatsApp(o)}>📲</button>
                        <Link href={`/orcamentos/${o.id}`} className="btn btn-ghost btn-sm btn-icon" title="Ver">📄</Link>
                        <Link href={`/orcamentos/${o.id}/editar`} className="btn btn-ghost btn-sm btn-icon" title="Editar">✏️</Link>
                        {projetoId && (
                          <Link href={`/projetos/${projetoId}`} className="btn btn-ghost btn-sm" title="Ver projeto"
                            style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                            → Projeto
                          </Link>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ciclar status" onClick={() => cycleStatus(o)}>🔄</button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Excluir"
                          onClick={() => setDeleteTarget({ id: o.id, numero: `ORC-${new Date(o.created_at).getFullYear()}-${String(o.numero ?? 0).padStart(4, '0')}` })}
                          style={{ color: 'var(--red)' }}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

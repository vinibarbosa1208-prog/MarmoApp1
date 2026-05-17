'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/lib/projetos/types'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado',
}
const STATUS_BADGE: Record<ProjectStatus, string> = {
  em_andamento: 'badge-sent', concluido: 'badge-approved', cancelado: 'badge-draft',
}

function margemColor(pct: number): string {
  if (pct >= 30) return 'var(--green)'
  if (pct >= 10) return '#E67E22'
  return 'var(--red)'
}

interface NovoProjetoModalProps {
  onClose: () => void
  onSaved: () => void
}

function NovoProjetoModal({ onClose, onSaved }: NovoProjetoModalProps) {
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState('')
  const [valorVenda, setValorVenda] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0])

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nome: nome.trim(), valor_venda: parseFloat(valorVenda) || 0, descricao, data_inicio: dataInicio }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 480, marginTop: 60 }}>
        <div className="modal-header">
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 }}>Novo Projeto</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nome do projeto *</label>
            <input className="form-control" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Bancada cozinha João Silva" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor de venda (R$)</label>
              <input className="form-control" type="number" min="0" step="0.01" value={valorVenda}
                onChange={e => setValorVenda(e.target.value)} placeholder="0,00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data de início</label>
              <input className="form-control" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descrição</label>
            <textarea className="form-control" rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Observações..." />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn-gold" onClick={salvar} disabled={saving || !nome.trim()}>
              {saving ? 'Criando...' : 'Criar projeto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const url = filterStatus ? `/api/projetos?status=${filterStatus}` : '/api/projetos'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } })
      if (res.ok) setProjetos(await res.json())
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Projetos</h1>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Novo projeto</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['', 'em_andamento', 'concluido', 'cancelado'] as const).map(s => (
          <button key={s} className={`btn btn-sm ${filterStatus === s ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setFilterStatus(s)}>
            {s === '' ? 'Todos' : STATUS_LABEL[s as ProjectStatus]}
          </button>
        ))}
        {loading && <span style={{ fontSize: 12, color: 'var(--gray)', alignSelf: 'center' }}>Carregando...</span>}
      </div>

      {/* Stats */}
      {projetos.length > 0 && (() => {
        const ativos = projetos.filter(p => p.status === 'em_andamento')
        const receitaTotal = ativos.reduce((s, p) => s + p.valor_venda, 0)
        const custoTotal = ativos.reduce((s, p) => s + (p.custo_total ?? 0), 0)
        const margemMedia = receitaTotal > 0 ? Math.round(((receitaTotal - custoTotal) / receitaTotal) * 10000) / 100 : 0
        return (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value">{ativos.length}</div>
                <div className="stat-label">Projetos em andamento</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
              <div className="stat-info">
                <div className="stat-value">{fmt(receitaTotal)}</div>
                <div className="stat-label">Receita em andamento</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: margemColor(margemMedia) }}>
              <div className="stat-info">
                <div className="stat-value" style={{ color: margemColor(margemMedia) }}>{margemMedia}%</div>
                <div className="stat-label">Margem média</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Project cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {projetos.map(p => {
          const margem = p.margem_percentual ?? 0
          const cor = margemColor(margem)
          return (
            <Link key={p.id} href={`/projetos/${p.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ transition: 'box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow)')}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>{p.nome}</div>
                      {p.cliente_nome && <div style={{ fontSize: 12, color: 'var(--gray)' }}>{p.cliente_nome}</div>}
                    </div>
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 2 }}>Venda</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.valor_venda)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 2 }}>Custo</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.custo_total ?? 0)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 2 }}>Margem</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: cor }}>{margem}%</div>
                    </div>
                  </div>
                  {/* Margem bar */}
                  <div style={{ height: 4, background: 'var(--marble2)', borderRadius: 2, marginTop: 12 }}>
                    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, margem))}%`, background: cor, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
        {projetos.length === 0 && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--gray)', padding: '60px 0' }}>
            Nenhum projeto encontrado. <button className="btn btn-gold btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowModal(true)}>Criar primeiro projeto</button>
          </div>
        )}
      </div>

      {showModal && <NovoProjetoModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  )
}

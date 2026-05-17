'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/utils'
import { useApp } from '@/contexts/AppContext'
import LancarCustoModal from './LancarCustoModal'
import type { Project, ProjectCost, ProjectCostType } from '@/lib/projetos/types'

type ProjectWithBreakdown = Project & {
  custos: ProjectCost[]
  breakdown_por_tipo: { nome: string; cor: string; total: number }[]
}

function margemColor(pct: number): string {
  if (pct >= 30) return 'var(--green)'
  if (pct >= 10) return '#E67E22'
  return 'var(--red)'
}

export default function ProjetoDetalhe({ id }: { id: string }) {
  const { toast } = useApp()
  const router = useRouter()
  const [projeto, setProjeto] = useState<ProjectWithBreakdown | null>(null)
  const [tipos, setTipos] = useState<ProjectCostType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const [projRes, tiposRes] = await Promise.all([
        fetch(`/api/projetos/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/projetos/${id}/custos`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (!projRes.ok) { router.push('/projetos'); return }
      const projData = await projRes.json()
      if (tiposRes.ok) projData.custos = await tiposRes.json()

      setProjeto(projData)

      // Load cost types
      const { data: { user } } = await supabase.auth.getUser(token!)
      if (user) {
        const { data: usr } = await supabase.from('usuarios').select('marmoraria_id').eq('id', user.id).maybeSingle()
        if (usr?.marmoraria_id) {
          const { data: ct } = await supabase.from('project_cost_types').select('*').eq('marmoraria_id', usr.marmoraria_id).order('nome')
          setTipos(ct || [])
        }
      }
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function deletarCusto(custoId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/projetos/${id}/custos/${custoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) { toast('Custo removido', 'ok'); load() }
    else toast('Erro ao remover custo', 'err')
  }

  if (loading) return <div className="page-inner"><div style={{ textAlign: 'center', color: 'var(--gray)', padding: 60 }}>Carregando...</div></div>
  if (!projeto) return null

  const margem = projeto.margem_percentual ?? 0
  const cor = margemColor(margem)

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/projetos')} style={{ marginBottom: 4 }}>
            ← Projetos
          </button>
          <h1 className="page-title" style={{ marginTop: 4 }}>{projeto.nome}</h1>
          {projeto.cliente_nome && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{projeto.cliente_nome}</div>}
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Lançar custo</button>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="stat-info">
            <div className="stat-value">{fmt(projeto.valor_venda)}</div>
            <div className="stat-label">Valor de venda</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div className="stat-info">
            <div className="stat-value">{fmt(projeto.custo_total ?? 0)}</div>
            <div className="stat-label">Custo total</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: cor }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: cor }}>{fmt(projeto.margem_valor ?? 0)}</div>
            <div className="stat-label">Margem (R$)</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: cor }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: cor, fontSize: 24 }}>{margem}%</div>
            <div className="stat-label">Margem (%)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Breakdown por categoria */}
        <div className="card">
          <div className="card-header"><span className="card-title">Por categoria</span></div>
          <div className="card-body">
            {(projeto.breakdown_por_tipo || []).length === 0 && (
              <div style={{ color: 'var(--gray)', fontSize: 13 }}>Sem custos lançados</div>
            )}
            {(projeto.breakdown_por_tipo || []).map(b => {
              const pct = (projeto.custo_total ?? 0) > 0 ? (b.total / (projeto.custo_total ?? 1)) * 100 : 0
              return (
                <div key={b.nome} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.cor, display: 'inline-block' }} />
                      {b.nome}
                    </span>
                    <strong>{fmt(b.total)}</strong>
                  </div>
                  <div style={{ height: 5, background: 'var(--marble2)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: b.cor, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela de lançamentos */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Lançamentos</span>
            <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>+ Lançar</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(projeto.custos || []).map(c => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 12, color: 'var(--gray)' }}>
                      {new Date(c.data + 'T00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td>{c.descricao}</td>
                    <td>
                      {c.tipo ? (
                        <span style={{ fontSize: 12, color: c.tipo.cor, fontWeight: 500 }}>
                          {c.tipo.nome}
                        </span>
                      ) : <span style={{ color: 'var(--gray2)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.valor)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--red)' }}
                        onClick={() => deletarCusto(c.id)} title="Remover">✕</button>
                    </td>
                  </tr>
                ))}
                {(projeto.custos || []).length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray)', padding: '20px 0' }}>Nenhum custo lançado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <LancarCustoModal
          projectId={id}
          tipos={tipos}
          onClose={() => setShowModal(false)}
          onSaved={load}
          toast={toast}
        />
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  rascunho: '#8B8B9A', enviado: '#2980B9', aprovado: '#27AE60', recusado: '#C0392B',
}
const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { rascunho: 'badge-draft', enviado: 'badge-sent', aprovado: 'badge-approved', recusado: 'badge-rejected', expired: 'badge-expired' }
  const lbl: Record<string, string> = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', expired: 'Expirado' }
  return <span className={`badge ${cls[status] || 'badge-draft'}`}>{lbl[status] || status}</span>
}

export default function DashboardPage() {
  const { orcamentos, materiais, clientes } = useApp()

  const totalOrc = orcamentos.length
  const aprovados = orcamentos.filter(o => o.status === 'aprovado')
  const receita = aprovados.reduce((s, o) => s + orcTotal(o), 0)
  const pipeline = orcamentos.filter(o => o.status === 'enviado').reduce((s, o) => s + orcTotal(o), 0)
  const alertas = materiais.filter(m => (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0)).length
  const taxaConv = totalOrc ? Math.round(aprovados.length / totalOrc * 100) : 0

  const recentOrcs = [...orcamentos].slice(0, 4)

  function clienteNome(id?: string) {
    if (!id) return '—'
    const c = clientes.find(c => c.id === id)
    return c ? c.nome : '—'
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/orcamentos/novo" className="btn btn-gold">✨ Novo Orçamento</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalOrc}</div>
            <div className="stat-label">Orçamentos</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div className="stat-icon" style={{ background: 'rgba(39,174,96,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{fmt(receita)}</div>
            <div className="stat-label">Receita aprovada</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="stat-icon" style={{ background: 'rgba(41,128,185,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{fmt(pipeline)}</div>
            <div className="stat-label">Em pipeline</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: alertas > 0 ? 'var(--red)' : 'var(--green)' }}>
          <div className="stat-icon" style={{ background: alertas > 0 ? 'rgba(192,57,43,0.12)' : 'rgba(39,174,96,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={alertas > 0 ? 'var(--red)' : 'var(--green)'} strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{alertas}</div>
            <div className="stat-label">Alertas de estoque</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Orçamentos Recentes</span>
            <Link href="/orcamentos" className="btn btn-outline btn-sm">Ver todos</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrcs.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500 }}>{o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}</td>
                    <td className="text-gray text-sm">{clienteNome(o.clienteId || o.cliente_id)}</td>
                    <td className="font-bold">{fmt(orcTotal(o))}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
                {recentOrcs.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray)', padding: '20px 0' }}>Nenhum orçamento ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Pipeline</span></div>
          <div className="card-body">
            {(['rascunho', 'enviado', 'aprovado', 'recusado'] as const).map(s => {
              const count = orcamentos.filter(o => o.status === s).length
              const pct = totalOrc ? count / totalOrc * 100 : 0
              return (
                <div key={s} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{STATUS_LABELS[s]}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="pipeline-bar">
                    <div className="pipeline-seg" style={{ width: `${pct}%`, background: STATUS_COLORS[s] }} />
                  </div>
                </div>
              )
            })}
            <hr className="divider" />
            <div style={{ fontSize: 13, color: 'var(--gray)' }}>
              Taxa de conversão: <strong style={{ color: 'var(--green)' }}>{taxaConv}%</strong>
            </div>
          </div>
        </div>
      </div>

      {alertas > 0 && (
        <div className="alert alert-danger mt-4">
          ⚠️ {alertas} material(is) abaixo do estoque mínimo —{' '}
          <Link href="/estoque" style={{ color: 'inherit', fontWeight: 600 }}>ver estoque</Link>
        </div>
      )}
    </div>
  )
}

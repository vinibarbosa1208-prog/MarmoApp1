'use client'

import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'

export default function RelatoriosPage() {
  const { orcamentos, clientes, materiais } = useApp()

  const totalOrcs = orcamentos.length
  const aprovados = orcamentos.filter(o => o.status === 'aprovado')
  const recusados = orcamentos.filter(o => o.status === 'recusado')
  const receita = aprovados.reduce((s, o) => s + orcTotal(o), 0)
  const ticketMedio = aprovados.length ? receita / aprovados.length : 0
  const taxaConv = totalOrcs ? Math.round(aprovados.length / totalOrcs * 100) : 0

  const porStatus = ['rascunho', 'enviado', 'aprovado', 'recusado', 'expired'].map(s => ({
    label: { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', expired: 'Expirado' }[s] || s,
    count: orcamentos.filter(o => o.status === s).length,
    color: { rascunho: '#8B8B9A', enviado: '#2980B9', aprovado: '#27AE60', recusado: '#C0392B', expired: '#E67E22' }[s] || '#888',
  }))

  const topClientes = clientes.map(c => {
    const orcs = orcamentos.filter(o => (o.clienteId || o.cliente_id) === c.id && o.status === 'aprovado')
    return { nome: c.nome, total: orcs.reduce((s, o) => s + orcTotal(o), 0), count: orcs.length }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 5)

  const alertas = materiais.filter(m => (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0))

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{totalOrcs}</div>
            <div className="stat-label">Total de orçamentos</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div className="stat-icon" style={{ background: 'rgba(39,174,96,0.12)', fontSize: 22 }}>💰</div>
          <div className="stat-info">
            <div className="stat-value">{fmt(receita)}</div>
            <div className="stat-label">Receita total aprovada</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="stat-icon" style={{ background: 'rgba(41,128,185,0.12)', fontSize: 22 }}>🎯</div>
          <div className="stat-info">
            <div className="stat-value">{taxaConv}%</div>
            <div className="stat-label">Taxa de conversão</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--gold)' }}>
          <div className="stat-icon" style={{ fontSize: 22 }}>📈</div>
          <div className="stat-info">
            <div className="stat-value">{fmt(ticketMedio)}</div>
            <div className="stat-label">Ticket médio</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Orçamentos por Status</span></div>
          <div className="card-body">
            {porStatus.map(s => (
              <div key={s.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{s.label}</span>
                  <strong>{s.count}</strong>
                </div>
                <div className="pipeline-bar">
                  <div className="pipeline-seg" style={{ width: totalOrcs ? `${s.count / totalOrcs * 100}%` : '0%', background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Top Clientes</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Cliente</th><th>Orçamentos</th><th>Total</th></tr></thead>
              <tbody>
                {topClientes.length === 0 ? (
                  <tr><td colSpan={3}><div className="empty-state"><p>Sem dados ainda</p></div></td></tr>
                ) : topClientes.map(c => (
                  <tr key={c.nome}>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td className="text-sm text-gray">{c.count}</td>
                    <td className="font-bold">{fmt(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><span className="card-title">⚠️ Alertas de Estoque</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Material</th><th>Atual</th><th>Mínimo</th></tr></thead>
              <tbody>
                {alertas.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.nome}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 700 }}>{m.estoque_atual}</td>
                    <td>{m.estoque_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

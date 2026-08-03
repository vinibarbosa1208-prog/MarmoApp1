'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import { fmt, orcTotal, areaCortadaItens, mlAcabamentoItens, mediaDiariaPCP } from '@/lib/utils'

export default function RelatoriosPage() {
  const { orcamentos, clientes, materiais } = useApp()

  const [apontamentos, setApontamentos] = useState<{ etapa: string; quantidade: number; data: string }[]>([])
  const [instalacoes, setInstalacoes] = useState<{ metros_lineares: number; data: string }[]>([])
  const [pendentes, setPendentes] = useState<{ corte: number; acabamento: number }>({ corte: 0, acabamento: 0 })
  const [loadingPCP, setLoadingPCP] = useState(true)

  useEffect(() => {
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    const desdeStr = desde.toISOString().split('T')[0]

    async function carregarPCP() {
      const [apRes, instRes, pendRes] = await Promise.all([
        supabase.from('producao_apontamentos').select('etapa, quantidade, data').gte('data', desdeStr),
        supabase.from('funcionario_instalacoes').select('metros_lineares, data').gte('data', desdeStr),
        supabase.from('orcamentos').select('id, producao_status').in('producao_status', ['corte', 'acabamento']),
      ])
      setApontamentos(apRes.data || [])
      setInstalacoes((instRes.data as any) || [])

      const pendOrcs = pendRes.data || []
      if (pendOrcs.length > 0) {
        const { data: itensPend } = await supabase
          .from('orcamento_itens')
          .select('orcamento_id, area, quantidade, largura, altura, acabamento_esquerda, acabamento_direita, acabamento_frente, acabamento_fundo')
          .in('orcamento_id', pendOrcs.map(p => p.id))
        let corte = 0, acabamento = 0
        for (const p of pendOrcs) {
          const itensDoOrc = (itensPend || []).filter(i => i.orcamento_id === p.id)
          if (p.producao_status === 'corte') corte += areaCortadaItens(itensDoOrc as any)
          if (p.producao_status === 'acabamento') acabamento += mlAcabamentoItens(itensDoOrc as any)
        }
        setPendentes({ corte, acabamento })
      }
      setLoadingPCP(false)
    }
    carregarPCP()
  }, [])

  const capCorte = mediaDiariaPCP(apontamentos.filter(a => a.etapa === 'corte'))
  const capAcabamento = mediaDiariaPCP(apontamentos.filter(a => a.etapa === 'acabamento'))
  const capInstalacao = mediaDiariaPCP(instalacoes.map(i => ({ quantidade: i.metros_lineares, data: i.data })))
  const diasFilaCorte = capCorte > 0 ? Math.ceil(pendentes.corte / capCorte) : null
  const diasFilaAcabamento = capAcabamento > 0 ? Math.ceil(pendentes.acabamento / capAcabamento) : null
  const temDadosPCP = capCorte > 0 || capAcabamento > 0 || capInstalacao > 0

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

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><span className="card-title">🏭 Capacidade Produtiva (PCP)</span></div>
        <div className="card-body">
          {loadingPCP ? (
            <div style={{ padding: 12, color: 'var(--gray)', fontSize: 13 }}>Carregando...</div>
          ) : !temDadosPCP ? (
            <div style={{ padding: 12, color: 'var(--gray)', fontSize: 13 }}>
              Ainda sem dados suficientes. Assim que pedidos começarem a sair de Corte e Acabamento na Fila de Serviços, a capacidade diária média aparece aqui automaticamente — sem precisar preencher nada.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 16 }}>Médias com base nos últimos 30 dias de produção registrada</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Corte</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{capCorte > 0 ? `${capCorte.toFixed(1)} m²/dia` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Acabamento</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{capAcabamento > 0 ? `${capAcabamento.toFixed(1)} ml/dia` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Instalação</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{capInstalacao > 0 ? `${capInstalacao.toFixed(1)} ml/dia` : '—'}</div>
                </div>
              </div>

              {(diasFilaCorte !== null || diasFilaAcabamento !== null) && (
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>Fila Atual — Prazo Estimado</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    {diasFilaCorte !== null && (
                      <div>Corte: <strong>{pendentes.corte.toFixed(1)} m²</strong> pendentes → cerca de <strong>{diasFilaCorte} dia{diasFilaCorte !== 1 ? 's' : ''}</strong> pra zerar no ritmo atual</div>
                    )}
                    {diasFilaAcabamento !== null && (
                      <div>Acabamento: <strong>{pendentes.acabamento.toFixed(1)} ml</strong> pendentes → cerca de <strong>{diasFilaAcabamento} dia{diasFilaAcabamento !== 1 ? 's' : ''}</strong> pra zerar no ritmo atual</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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

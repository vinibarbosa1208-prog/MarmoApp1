'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import { fmt, orcTotal, areaCortadaItens, mlAcabamentoItens, mediaDiariaPCP } from '@/lib/utils'

export default function RelatoriosPage() {
  const { orcamentos, clientes, materiais } = useApp()

  const [apontamentos, setApontamentos] = useState<{ etapa: string; quantidade: number; data: string; funcionario_id: string | null }[]>([])
  const [instalacoes, setInstalacoes] = useState<{ metros_lineares: number; data: string; funcionario_id: string | null }[]>([])
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; cargo: string }[]>([])
  const [pendentes, setPendentes] = useState<{ corte: number; acabamento: number }>({ corte: 0, acabamento: 0 })
  const [loadingPCP, setLoadingPCP] = useState(true)

  useEffect(() => {
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    const desdeStr = desde.toISOString().split('T')[0]

    async function carregarPCP() {
      const [apRes, instRes, pendRes, funcRes] = await Promise.all([
        supabase.from('producao_apontamentos').select('etapa, quantidade, data, funcionario_id').gte('data', desdeStr),
        supabase.from('funcionario_instalacoes').select('metros_lineares, data, funcionario_id').gte('data', desdeStr),
        supabase.from('orcamentos').select('id, producao_status').in('producao_status', ['corte', 'acabamento']),
        fetch('/api/funcionarios', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      ])
      setApontamentos((apRes.data as any) || [])
      setInstalacoes((instRes.data as any) || [])
      setFuncionarios(funcRes || [])

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

  // Capacidade média diária por funcionário — base pra definir metas individuais
  const capacidadePorFuncionario = funcionarios
    .filter(f => f.cargo === 'serrador' || f.cargo === 'acabador' || f.cargo === 'instalador')
    .map(f => {
      const registros = f.cargo === 'instalador'
        ? instalacoes.filter(i => i.funcionario_id === f.id).map(i => ({ quantidade: i.metros_lineares, data: i.data }))
        : apontamentos.filter(a => a.funcionario_id === f.id && a.etapa === f.cargo.replace('serrador', 'corte').replace('acabador', 'acabamento'))
      return {
        nome: f.nome,
        cargo: f.cargo,
        media: mediaDiariaPCP(registros),
        unidade: f.cargo === 'serrador' ? 'm²/dia' : 'ml/dia',
      }
    })
    .filter(f => f.media > 0)
    .sort((a, b) => b.media - a.media)

  const [tipoPeriodo, setTipoPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('mes')
  const [dataRef, setDataRef] = useState(new Date().toISOString().split('T')[0])

  // Calcula o início/fim do período selecionado, sempre em torno da dataRef
  function calcularIntervalo(tipo: typeof tipoPeriodo, refStr: string): { inicio: string; fim: string } {
    const ref = new Date(refStr + 'T00:00:00')
    let inicio: Date, fim: Date
    if (tipo === 'dia') {
      inicio = ref; fim = ref
    } else if (tipo === 'semana') {
      const diaSemana = ref.getDay() // 0 = domingo
      const offsetSegunda = diaSemana === 0 ? 6 : diaSemana - 1
      inicio = new Date(ref); inicio.setDate(ref.getDate() - offsetSegunda)
      fim = new Date(inicio); fim.setDate(inicio.getDate() + 6)
    } else if (tipo === 'mes') {
      inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
      fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    } else {
      inicio = new Date(ref.getFullYear(), 0, 1)
      fim = new Date(ref.getFullYear(), 11, 31)
    }
    return { inicio: inicio.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] }
  }

  const { inicio: inicioPeriodo, fim: fimPeriodo } = calcularIntervalo(tipoPeriodo, dataRef)

  // Vendas confirmadas = orçamentos aprovados cuja data_fechamento cai dentro do período selecionado
  const vendasPeriodo = orcamentos.filter(o => {
    const df = (o as any).data_fechamento as string | null | undefined
    return o.status === 'aprovado' && !!df && df >= inicioPeriodo && df <= fimPeriodo
  })

  const totalOrcs = orcamentos.length
  const aprovados = orcamentos.filter(o => o.status === 'aprovado')
  const recusados = orcamentos.filter(o => o.status === 'recusado')
  const receitaPeriodo = vendasPeriodo.reduce((s, o) => s + orcTotal(o), 0)
  const ticketMedioPeriodo = vendasPeriodo.length ? receitaPeriodo / vendasPeriodo.length : 0
  const taxaConv = totalOrcs ? Math.round(aprovados.length / totalOrcs * 100) : 0

  const porStatus = ['rascunho', 'enviado', 'aprovado', 'recusado', 'expired'].map(s => ({
    label: { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', expired: 'Expirado' }[s] || s,
    count: orcamentos.filter(o => o.status === s).length,
    color: { rascunho: '#8B8B9A', enviado: '#2980B9', aprovado: '#27AE60', recusado: '#C0392B', expired: '#E67E22' }[s] || '#888',
  }))

  const topClientes = clientes.map(c => {
    const orcs = vendasPeriodo.filter(o => (o.clienteId || o.cliente_id) === c.id)
    return { nome: c.nome, total: orcs.reduce((s, o) => s + orcTotal(o), 0), count: orcs.length }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 5)

  const alertas = materiais.filter(m => (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0))

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Vendas confirmadas por período</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['dia', 'semana', 'mes', 'ano'] as const).map(t => (
              <button
                key={t}
                className={`btn btn-sm ${tipoPeriodo === t ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setTipoPeriodo(t)}
              >
                {{ dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' }[t]}
              </button>
            ))}
          </div>
          <input className="form-input" type="date" style={{ width: 160 }} value={dataRef} onChange={e => setDataRef(e.target.value)} />
          <span style={{ fontSize: 12, color: 'var(--gray)' }}>
            {inicioPeriodo === fimPeriodo
              ? new Date(inicioPeriodo + 'T00:00:00').toLocaleDateString('pt-BR')
              : `${new Date(inicioPeriodo + 'T00:00:00').toLocaleDateString('pt-BR')} – ${new Date(fimPeriodo + 'T00:00:00').toLocaleDateString('pt-BR')}`}
          </span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{vendasPeriodo.length}</div>
            <div className="stat-label">Vendas confirmadas no período</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div className="stat-icon" style={{ background: 'rgba(39,174,96,0.12)', fontSize: 22 }}>💰</div>
          <div className="stat-info">
            <div className="stat-value">{fmt(receitaPeriodo)}</div>
            <div className="stat-label">Receita confirmada no período</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="stat-icon" style={{ background: 'rgba(41,128,185,0.12)', fontSize: 22 }}>🎯</div>
          <div className="stat-info">
            <div className="stat-value">{taxaConv}%</div>
            <div className="stat-label">Taxa de conversão (geral)</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--gold)' }}>
          <div className="stat-icon" style={{ fontSize: 22 }}>📈</div>
          <div className="stat-info">
            <div className="stat-value">{fmt(ticketMedioPeriodo)}</div>
            <div className="stat-label">Ticket médio no período</div>
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
          <div className="card-header"><span className="card-title">Top Clientes no Período</span></div>
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

              {capacidadePorFuncionario.length > 0 && (
                <div style={{ paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--divider)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>Capacidade Média por Funcionário — base pra metas individuais</div>
                  <table>
                    <thead><tr><th>Nome</th><th>Função</th><th>Média/dia</th></tr></thead>
                    <tbody>
                      {capacidadePorFuncionario.map(f => (
                        <tr key={f.nome + f.cargo}>
                          <td style={{ fontWeight: 500 }}>{f.nome}</td>
                          <td className="text-sm text-gray" style={{ textTransform: 'capitalize' }}>{f.cargo}</td>
                          <td className="font-bold">{f.media.toFixed(1)} {f.unidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

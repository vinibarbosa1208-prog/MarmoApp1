'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'
import {
  periodoDoMes, periodoDoAno, resumoPeriodo, serieMensal, variacao, dataFechamento,
  MESES_LONGOS, type Ranking, type PontoMensal,
} from '@/lib/dashboard'

function WelcomeBanner() {
  const searchParams = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setShow(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('checkout')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  if (!show) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.06))',
      border: '1px solid rgba(201,168,76,0.35)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>🎉</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
            Bem-vindo ao MarmoApp! Seu trial de 7 dias começou.
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Seu cartão só será cobrado após os 7 dias gratuitos. Explore à vontade!
          </div>
        </div>
      </div>
      <button
        onClick={() => setShow(false)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
      >✕</button>
    </div>
  )
}

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

// ---------- formatação ----------
const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const n0 = (v: number) => Math.round(v).toLocaleString('pt-BR')
function fmtCurto(v: number): string {
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
  if (v >= 1_000) return 'R$ ' + (v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
  return 'R$ ' + n0(v)
}
function fmtQtd(v: number, unidade?: string) {
  if (unidade === 'pç' || unidade === 'un') return `${n0(v)} ${unidade}`
  return `${n2(v)}${unidade ? ' ' + unidade : ''}`
}

function Delta({ atual, anterior, rotulo }: { atual: number; anterior: number; rotulo: string }) {
  const v = variacao(atual, anterior)
  if (v === null) {
    return <span className="dsh-delta flat">{atual > 0 ? `sem base ${rotulo}` : '—'}</span>
  }
  const cls = Math.abs(v) < 0.5 ? 'flat' : v > 0 ? 'up' : 'down'
  const seta = cls === 'flat' ? '=' : v > 0 ? '▲' : '▼'
  return <span className={`dsh-delta ${cls}`}>{seta} {Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>{rotulo}</span></span>
}

function Kpi({ label, valor, unidade, atual, anterior, rotulo, sub, destaque }: {
  label: string; valor: string; unidade?: string; atual?: number; anterior?: number; rotulo: string; sub?: string; destaque?: boolean
}) {
  return (
    <div className={`dsh-kpi${destaque ? ' destaque' : ''}`}>
      <div className="dsh-kpi-label">{label}</div>
      <div className="dsh-kpi-valor" title={valor + (unidade ? ' ' + unidade : '')}>{valor}{unidade && <span>{unidade}</span>}</div>
      <div className="dsh-kpi-sub">
        {atual !== undefined && anterior !== undefined ? <Delta atual={atual} anterior={anterior} rotulo={rotulo} /> : sub}
      </div>
    </div>
  )
}

function RankingCard({ titulo, itens, modo, onModo, vazio, limite = 8 }: {
  titulo: string; itens: Ranking[]; modo?: 'qtd' | 'valor'; onModo?: (m: 'qtd' | 'valor') => void; vazio: string; limite?: number
}) {
  const m = modo || 'valor'
  const ordenados = [...itens].sort((a, b) => b[m] - a[m]).slice(0, limite)
  const max = ordenados.reduce((s, r) => Math.max(s, r[m]), 0)
  const unidadeQtd = itens[0]?.unidade
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="dsh-card-head">
        <span className="card-title">{titulo}</span>
        {onModo && (
          <div className="dsh-seg" role="group" aria-label="Ordenar por">
            <button className={m === 'qtd' ? 'ativo' : ''} onClick={() => onModo('qtd')}>{unidadeQtd || 'Qtd'}</button>
            <button className={m === 'valor' ? 'ativo' : ''} onClick={() => onModo('valor')}>R$</button>
          </div>
        )}
      </div>
      {ordenados.length === 0 ? <div className="dsh-vazio">{vazio}</div> : (
        <ol className="dsh-rank">
          {ordenados.map((r, idx) => (
            <li key={r.nome + idx}>
              <div className="dsh-rank-top">
                <span className="dsh-rank-nome" title={r.nome}>{idx + 1}. {r.nome}</span>
                <span className="dsh-rank-val">{m === 'valor' ? fmt(r.valor) : fmtQtd(r.qtd, r.unidade)}</span>
              </div>
              <div className="dsh-bar"><div style={{ width: `${max ? Math.max(2, r[m] / max * 100) : 0}%` }} /></div>
              <div className="dsh-rank-sub">
                <span>{r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                <span>{m === 'valor' ? (r.qtd > 0 ? fmtQtd(r.qtd, r.unidade) : '') : fmt(r.valor)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

type MetricaSerie = 'receita' | 'meiaEsquadria' | 'reto'
const METRICA_LABEL: Record<MetricaSerie, string> = { receita: 'Receita', meiaEsquadria: 'Meia esquadria', reto: 'Reto' }

function EvolucaoChart({ serie, metrica, ativoChave, onSelecionar }: {
  serie: PontoMensal[]; metrica: MetricaSerie; ativoChave: string | null; onSelecionar: (p: PontoMensal) => void
}) {
  const max = serie.reduce((s, p) => Math.max(s, p[metrica]), 0)
  const fmtV = (v: number) => metrica === 'receita' ? fmtCurto(v) : `${n1(v)} ml`
  return (
    <div className="dsh-chart">
      <div className="dsh-cols">
        {serie.map((p, idx) => (
          <button
            key={p.chave}
            className={`dsh-col${ativoChave === p.chave ? ' ativo' : ''}${idx < 3 ? ' tip-esq' : idx >= serie.length - 3 ? ' tip-dir' : ''}`}
            onClick={() => onSelecionar(p)}
            aria-label={`${MESES_LONGOS[p.mes0]} ${p.ano}: ${fmtV(p[metrica])}`}
          >
            <span className="dsh-col-tip">
              <strong>{MESES_LONGOS[p.mes0]} {p.ano}</strong><br />
              Receita: {fmt(p.receita)}<br />
              Pedidos: {p.pedidos}<br />
              Meia esquadria: {n2(p.meiaEsquadria)} ml<br />
              Reto: {n2(p.reto)} ml
            </span>
            {p[metrica] > 0 && <span className="dsh-col-val">{fmtV(p[metrica])}</span>}
            <span className="dsh-col-bar" style={{ height: `${max ? p[metrica] / max * 82 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="dsh-cols-labels">
        {serie.map(p => <span key={p.chave} className={ativoChave === p.chave ? 'ativo' : ''}>{p.label}</span>)}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { orcamentos, materiais, clientes, servicos } = useApp()

  const hoje = new Date()
  const [modo, setModo] = useState<'mes' | 'ano'>('mes')
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes0, setMes0] = useState(hoje.getMonth())
  const [metrica, setMetrica] = useState<MetricaSerie>('receita')
  const [ordMateriais, setOrdMateriais] = useState<'qtd' | 'valor'>('qtd')
  const [ordPecas, setOrdPecas] = useState<'qtd' | 'valor'>('qtd')

  // Anos disponíveis: do primeiro orçamento até o ano atual
  const anos = useMemo(() => {
    let min = hoje.getFullYear()
    for (const o of orcamentos) {
      const d = dataFechamento(o) || String(o.created_at || '')
      const y = parseInt(d.slice(0, 4), 10)
      if (y && y < min) min = y
    }
    const arr: number[] = []
    for (let y = hoje.getFullYear(); y >= min; y--) arr.push(y)
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentos])

  const periodo = modo === 'mes' ? periodoDoMes(ano, mes0) : periodoDoAno(ano)
  const periodoAnterior = modo === 'mes'
    ? periodoDoMes(mes0 === 0 ? ano - 1 : ano, mes0 === 0 ? 11 : mes0 - 1)
    : periodoDoAno(ano - 1)
  const rotuloComp = modo === 'mes' ? 'vs mês ant.' : 'vs ano ant.'
  const tituloPeriodo = modo === 'mes' ? `${MESES_LONGOS[mes0]} de ${ano}` : `${ano}`
  const emAndamento = modo === 'mes'
    ? ano === hoje.getFullYear() && mes0 === hoje.getMonth()
    : ano === hoje.getFullYear()
  const avisoAndamento = emAndamento ? ` · ${modo === 'mes' ? 'mês' : 'ano'} em andamento, comparação com o período anterior completo` : ''

  const atual = useMemo(() => resumoPeriodo(orcamentos, periodo, servicos || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orcamentos, servicos, periodo.inicio, periodo.fim])
  const anterior = useMemo(() => resumoPeriodo(orcamentos, periodoAnterior, servicos || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orcamentos, servicos, periodoAnterior.inicio, periodoAnterior.fim])
  const serie = useMemo(
    () => modo === 'mes' ? serieMensal(orcamentos, ano, mes0, 12) : serieMensal(orcamentos, ano, 11, 12),
    [orcamentos, modo, ano, mes0])

  const ehFuturo = modo === 'mes'
    ? (ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes0 >= hoje.getMonth()))
    : ano >= hoje.getFullYear()

  function navegar(dir: -1 | 1) {
    if (modo === 'ano') { setAno(a => a + dir); return }
    const d = new Date(ano, mes0 + dir, 1)
    setAno(d.getFullYear()); setMes0(d.getMonth())
  }

  // Visão atual (não depende do período): pipeline em aberto e estoque
  const totalOrc = orcamentos.length
  const pipelineAberto = orcamentos.filter(o => o.status === 'enviado').reduce((s, o) => s + orcTotal(o), 0)
  const alertas = materiais.filter(m => (m.estoque_atual ?? 0) < (m.estoque_minimo ?? 0)).length
  const recentOrcs = [...orcamentos].slice(0, 5)

  function clienteNome(id?: string) {
    if (!id) return '—'
    const c = clientes.find(c => c.id === id)
    return c ? c.nome : '—'
  }

  const acab = atual.acabamentos
  const acabAnt = anterior.acabamentos
  const totalAcab = acab.meia_esquadria + acab.reto + acab.outros

  return (
    <div className="page-inner">

      <Suspense fallback={null}>
        <WelcomeBanner />
      </Suspense>

      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title">Dashboard</h1>
        <div className="dsh-filtros">
          <div className="dsh-seg" role="group" aria-label="Período">
            <button className={modo === 'mes' ? 'ativo' : ''} onClick={() => setModo('mes')}>Mês</button>
            <button className={modo === 'ano' ? 'ativo' : ''} onClick={() => setModo('ano')}>Ano</button>
          </div>
          <div className="dsh-nav">
            <button onClick={() => navegar(-1)} aria-label="Período anterior">‹</button>
            {modo === 'mes' && (
              <select value={mes0} onChange={e => setMes0(Number(e.target.value))} aria-label="Mês">
                {MESES_LONGOS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            )}
            <select value={ano} onChange={e => setAno(Number(e.target.value))} aria-label="Ano">
              {(anos.includes(ano) ? anos : [ano, ...anos]).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => navegar(1)} disabled={ehFuturo} aria-label="Próximo período">›</button>
          </div>
          <Link href="/orcamentos/novo" className="btn btn-gold">✨ Novo Orçamento</Link>
        </div>
      </div>

      {/* ── VENDAS ── */}
      <div className="dsh-secao" style={{ marginTop: 0 }}>Vendas <small>orçamentos aprovados em {tituloPeriodo}{avisoAndamento}</small></div>
      <div className="dsh-kpis">
        <Kpi destaque label="Receita aprovada" valor={fmt(atual.receita)} atual={atual.receita} anterior={anterior.receita} rotulo={rotuloComp} />
        <Kpi label="Pedidos fechados" valor={n0(atual.pedidos)} atual={atual.pedidos} anterior={anterior.pedidos} rotulo={rotuloComp} />
        <Kpi label="Ticket médio" valor={fmt(Math.round(atual.ticketMedio * 100) / 100)} atual={atual.ticketMedio} anterior={anterior.ticketMedio} rotulo={rotuloComp} />
        <Kpi label="Margem sobre material" valor={atual.margemMaterialPct === null ? '—' : `${n0(atual.margemMaterialPct)}%`}
          rotulo={rotuloComp}
          sub={atual.custoMaterial > 0 ? `custo ${fmt(atual.custoMaterial)} de ${fmt(atual.receitaMaterial)}` : 'sem custo lançado'} />
        <Kpi label="Conversão" valor={atual.conversaoPct === null ? '—' : `${n0(atual.conversaoPct)}%`}
          rotulo={rotuloComp}
          sub={atual.criados ? `${atual.criadosAprovados} de ${atual.criados} orçamentos criados no período` : 'nenhum orçamento criado'} />
      </div>

      {/* ── PRODUÇÃO ── */}
      <div className="dsh-secao">Produção vendida <small>metragem dos pedidos aprovados em {tituloPeriodo}</small></div>
      <div className="dsh-kpis">
        <Kpi destaque label="Meia esquadria" valor={n2(acab.meia_esquadria)} unidade="ml" atual={acab.meia_esquadria} anterior={acabAnt.meia_esquadria} rotulo={rotuloComp} />
        <Kpi destaque label="Acabamento reto" valor={n2(acab.reto)} unidade="ml" atual={acab.reto} anterior={acabAnt.reto} rotulo={rotuloComp} />
        <Kpi label="Material vendido" valor={n2(atual.m2Material)} unidade="m²" atual={atual.m2Material} anterior={anterior.m2Material} rotulo={rotuloComp} />
        <Kpi label="Colocação" valor={n2(atual.colocacaoMl)} unidade="ml" atual={atual.colocacaoMl} anterior={anterior.colocacaoMl} rotulo={rotuloComp} />
        <Kpi label="Peças" valor={n0(atual.pecas)} unidade="pç"
          rotulo={rotuloComp}
          sub={totalAcab > 0 ? `${n2(totalAcab)} ml de acabamento no total${acab.outros > 0 ? ` (${n2(acab.outros)} ml outros)` : ''}` : 'sem acabamento no período'} />
      </div>

      {/* ── EVOLUÇÃO ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="dsh-card-head">
          <span className="card-title">Evolução {modo === 'mes' ? '— últimos 12 meses' : `— ${ano}`}</span>
          <div className="dsh-seg" role="group" aria-label="Métrica">
            {(Object.keys(METRICA_LABEL) as MetricaSerie[]).map(k => (
              <button key={k} className={metrica === k ? 'ativo' : ''} onClick={() => setMetrica(k)}>{METRICA_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <EvolucaoChart
          serie={serie}
          metrica={metrica}
          ativoChave={modo === 'mes' ? `${ano}-${mes0}` : null}
          onSelecionar={p => { setModo('mes'); setAno(p.ano); setMes0(p.mes0) }}
        />
      </div>

      {/* ── RANKINGS ── */}
      <div className="dsh-secao">Mais vendidos <small>{tituloPeriodo}</small></div>
      <div className="dsh-grid-3">
        <RankingCard titulo="Materiais" itens={atual.materiais} modo={ordMateriais} onModo={setOrdMateriais}
          vazio="Nenhum material vendido no período" />
        <RankingCard titulo="Tipos de peça" itens={atual.tiposPeca} modo={ordPecas} onModo={setOrdPecas}
          vazio="Nenhuma peça com tipo definido no período" />
        <RankingCard titulo="Serviços" itens={atual.servicos} modo="valor"
          vazio="Nenhum serviço vendido no período" />
      </div>

      {/* ── SITUAÇÃO ATUAL ── */}
      <div className="dsh-secao">Situação atual <small>todos os orçamentos, sem filtro de período</small></div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Orçamentos Recentes</span>
            <Link href="/orcamentos" className="btn btn-outline btn-sm">Ver todos</Link>
          </div>
          <div className="card-body table-wrap" style={{ padding: 0 }}>
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
                    <td style={{ fontWeight: 500 }}>
                      <Link href={`/orcamentos/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}
                      </Link>
                    </td>
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
          <div className="card-header">
            <span className="card-title">Pipeline</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Em aberto: <strong style={{ color: 'var(--text)' }}>{fmt(pipelineAberto)}</strong></span>
          </div>
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
            <div style={{ fontSize: 13, color: 'var(--gray)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{totalOrc} orçamentos no total</span>
              <span>Alertas de estoque: <strong style={{ color: alertas > 0 ? 'var(--red)' : 'var(--green)' }}>{alertas}</strong></span>
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

      <p className="dsh-nota">
        Como os números são calculados: o mês de cada pedido é a data em que o orçamento foi aprovado.
        Acabamentos vêm das linhas de serviço do orçamento (ex.: &quot;Acabamento meia esquadria&quot;); quando o orçamento
        não tem essas linhas, usamos os lados marcados no desenho das peças. A margem considera só o custo do material.
      </p>
    </div>
  )
}

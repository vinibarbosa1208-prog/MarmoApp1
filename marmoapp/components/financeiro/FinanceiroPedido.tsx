'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
import { type Lancamento, FORMAS_PAGAMENTO, hojeISO, situacao } from '@/lib/financeiro'
import ParcelasPedidoModal from '@/components/financeiro/ParcelasPedidoModal'
import BaixaModal from '@/components/financeiro/BaixaModal'

// Aba "Financeiro" dentro do pedido: formas de pagamento, o que já entrou,
// o que falta receber. Tudo aqui é o mesmo lançamento que aparece em
// Financeiro → Contas a Receber (tabela financeiro_lancamentos, orcamento_id).

const api = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function RegistrarPagamentoModal({ orcamentoId, cliente, sugestao, onFechar, onSalvo }: {
  orcamentoId: string; cliente: string | null; sugestao: number; onFechar: () => void; onSalvo: () => void
}) {
  const { toast } = useApp()
  const [f, setF] = useState({ descricao: 'Pagamento recebido', valor: sugestao > 0 ? sugestao.toFixed(2) : '', data: hojeISO(), forma: '' })
  const [salvando, setSalvando] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  async function salvar() {
    setSalvando(true)
    try {
      const res = await api('/api/financeiro/lancamentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'receber', origem: 'orcamento', orcamento_id: orcamentoId, categoria: 'venda',
          descricao: f.descricao, contraparte: cliente, valor: f.valor,
          vencimento: f.data, data_pagamento: f.data, status: 'pago', forma_pagamento: f.forma,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao registrar')
      onSalvo()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao registrar', 'err')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">Registrar pagamento recebido</div>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Para um valor que entrou fora das parcelas combinadas (ex.: cliente adiantou parte do saldo). Se for uma parcela já programada, use “Receber” na linha dela.
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIÇÃO</label>
            <input className="form-input" value={f.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">VALOR (R$)</label>
              <input className="form-input" type="number" step="0.01" value={f.valor} onChange={e => set('valor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">DATA</label>
              <input className="form-input" type="date" value={f.data} onChange={e => set('data', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">FORMA</label>
              <select className="form-select" value={f.forma} onChange={e => set('forma', e.target.value)}>
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroPedido({ orcamentoId, titulo, total, aprovado, cliente, dataInstalacao, abrirDefinir }: {
  orcamentoId: string
  titulo: string
  total: number
  aprovado: boolean
  cliente: string | null
  dataInstalacao: string | null
  /** Abre direto o campo de formas de pagamento (vindo de uma aprovação) */
  abrirDefinir?: boolean
}) {
  const { toast } = useApp()
  const [lancs, setLancs] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalDefinir, setModalDefinir] = useState(false)
  const [modalRegistrar, setModalRegistrar] = useState(false)
  const [baixa, setBaixa] = useState<Lancamento[] | null>(null)
  const [abriuAuto, setAbriuAuto] = useState(false)

  const carregar = useCallback(async () => {
    const res = await api(`/api/financeiro/lancamentos?tipo=receber&orcamento_id=${orcamentoId}`)
    if (res.ok) setLancs(await res.json())
    setLoading(false)
  }, [orcamentoId])
  useEffect(() => { carregar() }, [carregar])

  const ativos = lancs.filter(l => l.status !== 'cancelado')
  const recebido = ativos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const aberto = ativos.filter(l => l.status === 'previsto').reduce((s, l) => s + Number(l.valor), 0)
  const semForma = Math.round((total - recebido - aberto) * 100) / 100
  const pctRecebido = total > 0 ? Math.min(100, (recebido / total) * 100) : 0
  const pctAberto = total > 0 ? Math.min(100 - pctRecebido, (aberto / total) * 100) : 0
  const vencido = ativos.filter(l => situacao(l) === 'vencido').reduce((s, l) => s + Number(l.valor), 0)
  const restanteParaDefinir = Math.round((total - recebido) * 100) / 100

  // Vindo de uma aprovação: abre o campo sozinho, uma vez, se ainda não há nada lançado.
  useEffect(() => {
    if (!abrirDefinir || abriuAuto || loading) return
    setAbriuAuto(true)
    if (ativos.length === 0 && total > 0) setModalDefinir(true)
  }, [abrirDefinir, abriuAuto, loading, ativos.length, total])

  async function acao(l: Lancamento, metodo: 'PATCH' | 'DELETE', body: Record<string, unknown> | null, pergunta: string, ok: string) {
    if (!confirm(pergunta)) return
    const res = await api(`/api/financeiro/lancamentos/${l.id}`, { method: metodo, body: body ? JSON.stringify(body) : undefined })
    if (res.ok) { toast(ok, 'ok2'); carregar() } else { const d = await res.json(); toast(d.error || 'Erro', 'err') }
  }

  const label = { fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' as const, marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!loading && aprovado && ativos.length === 0 && total > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Pedido aprovado — defina as formas de pagamento</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Os pagamentos futuros entram sozinhos em Contas a Receber.</div>
            </div>
            <button className="btn btn-gold" onClick={() => setModalDefinir(true)}>Definir formas de pagamento</button>
          </div>
        </div>
      )}
      {!loading && !aprovado && ativos.length === 0 && (
        <div className="card"><div className="card-body" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          As formas de pagamento são pedidas quando o orçamento é aprovado. Se o cliente já combinou como vai pagar, dá pra definir agora.
        </div></div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Resumo financeiro</span>
          <Link href="/financeiro?aba=receber" className="btn btn-ghost btn-sm">Ver em Contas a Receber →</Link>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 14 }}>
            <div><div style={label}>Valor do pedido</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(total)}</div></div>
            <div><div style={label}>Recebido</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fmt(recebido)}</div></div>
            <div>
              <div style={label}>A receber</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(aberto)}</div>
              {vencido > 0 && <div style={{ fontSize: 11, color: 'var(--red)' }}>{fmt(vencido)} vencido</div>}
            </div>
            <div>
              <div style={label}>{semForma >= 0 ? 'Sem forma definida' : 'Lançado a mais'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: Math.abs(semForma) > 0.009 ? 'var(--red)' : 'var(--text-muted)' }}>{fmt(Math.abs(semForma))}</div>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: 'var(--divider)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pctRecebido}%`, background: 'var(--green)' }} />
            <div style={{ width: `${pctAberto}%`, background: 'var(--gold)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            <span style={{ color: 'var(--green)' }}>■</span> recebido &nbsp; <span style={{ color: 'var(--gold)' }}>■</span> programado &nbsp; <span style={{ color: 'var(--gray)' }}>■</span> sem forma definida
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title">Pagamentos do pedido</span>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setModalRegistrar(true)}>+ Registrar pagamento recebido</button>
            <button className="btn btn-gold btn-sm" onClick={() => setModalDefinir(true)} disabled={restanteParaDefinir <= 0}>
              {ativos.some(l => l.status === 'previsto') ? 'Redefinir o que está em aberto' : 'Definir formas de pagamento'}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Pagamento</th><th>Forma</th><th className="text-right">Valor</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="empty-state"><p>Carregando…</p></div></td></tr>
              ) : lancs.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><p>Nenhum pagamento definido para este pedido.</p></div></td></tr>
              ) : lancs.map(l => {
                const s = situacao(l)
                return (
                  <tr key={l.id} style={{ opacity: l.status === 'cancelado' ? 0.5 : 1 }}>
                    <td className="text-sm" style={{ whiteSpace: 'nowrap', color: s === 'vencido' ? 'var(--red)' : undefined }}>
                      {fmtDate(l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento)}
                      {l.acompanha_instalacao && l.status === 'previsto' && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔗 instalação</div>}
                    </td>
                    <td style={{ fontWeight: 500 }}>{l.descricao.replace(/^Pedido #\d*\s—\s/, '')}</td>
                    <td className="text-sm">{l.forma_pagamento || '—'}</td>
                    <td className="text-right font-bold">{fmt(l.valor)}</td>
                    <td>
                      {s === 'pago' ? <span className="badge badge-ok">Recebido</span>
                        : s === 'cancelado' ? <span className="badge badge-draft">Cancelado</span>
                        : s === 'vencido' ? <span className="badge badge-low">Vencido</span>
                        : s === 'hoje' ? <span className="badge badge-expired">Vence hoje</span>
                        : <span className="badge badge-sent">A receber</span>}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {l.status === 'previsto' && <button className="btn btn-ghost btn-sm" onClick={() => setBaixa([l])}>✅ Receber</button>}
                        {l.status === 'pago' && <button className="btn btn-ghost btn-sm" onClick={() => acao(l, 'PATCH', { status: 'previsto' }, `Voltar "${l.descricao}" para a receber?`, 'Pagamento reaberto')}>↩ Reabrir</button>}
                        {l.status !== 'pago' && <button className="btn btn-ghost btn-sm" title="Excluir" onClick={() => acao(l, 'DELETE', null, `Excluir "${l.descricao}"?`, 'Pagamento excluído')}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalDefinir && (
        <ParcelasPedidoModal
          orcamentoId={orcamentoId}
          titulo={titulo}
          total={restanteParaDefinir}
          dataInstalacao={dataInstalacao}
          aviso={recebido > 0 ? `Já recebido: ${fmt(recebido)} (fica como está). Os pagamentos em aberto deste pedido serão substituídos pelos que você definir aqui.` : undefined}
          onFechar={() => setModalDefinir(false)}
          onSalvo={() => { setModalDefinir(false); carregar(); toast('Formas de pagamento salvas — Contas a Receber atualizado', 'ok2') }}
        />
      )}
      {modalRegistrar && (
        <RegistrarPagamentoModal orcamentoId={orcamentoId} cliente={cliente} sugestao={Math.max(0, aberto > 0 ? 0 : semForma)}
          onFechar={() => setModalRegistrar(false)}
          onSalvo={() => { setModalRegistrar(false); carregar(); toast('Pagamento registrado', 'ok2') }} />
      )}
      {baixa && (
        <BaixaModal itens={baixa} onFechar={() => setBaixa(null)}
          onSalvo={() => { setBaixa(null); carregar(); toast('Recebimento registrado', 'ok2') }} />
      )}
    </div>
  )
}

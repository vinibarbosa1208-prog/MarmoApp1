'use client'

import { useState } from 'react'
import { fmt } from '@/lib/utils'
import { hojeISO, addDiasISO, dividirEntradaSaldo, FORMAS_PAGAMENTO } from '@/lib/financeiro'

// "Formas de pagamento do pedido" — abre quando o pedido é aprovado
// (lista de orçamentos, tela Editar) e pela aba Financeiro do pedido.
// Cada linha vira um lançamento em Contas a Receber; marcada como
// "recebido", já entra como recebida. Padrão: entrada + saldo na
// instalação — o saldo acompanha a data de instalação sozinho (trigger
// no banco) se ela mudar depois na Fila de Serviços.

interface Linha {
  rotulo: string
  valor: string
  vencimento: string
  acompanha_instalacao: boolean
  forma_pagamento: string
  recebido: boolean
}

const LS_PCT = 'marmoapp.financeiro.pctEntrada'

function lerPct(): number {
  try { const v = Number(localStorage.getItem(LS_PCT)); return v > 0 && v < 100 ? v : 50 } catch { return 50 }
}

const linha = (l: Partial<Linha> & Pick<Linha, 'rotulo' | 'valor' | 'vencimento'>): Linha =>
  ({ acompanha_instalacao: false, forma_pagamento: '', recebido: false, ...l })

function linhasEntradaSaldo(total: number, pct: number, dataInstalacao: string): Linha[] {
  const { entrada, saldo } = dividirEntradaSaldo(total, pct)
  return [
    linha({ rotulo: `Entrada (${pct}%)`, valor: entrada.toFixed(2), vencimento: hojeISO() }),
    linha({ rotulo: 'Saldo na instalação', valor: saldo.toFixed(2), vencimento: dataInstalacao, acompanha_instalacao: true }),
  ]
}

function linhasParceladas(total: number, n: number): Linha[] {
  const base = Math.floor((total / n) * 100) / 100
  return Array.from({ length: n }, (_, i) => linha({
    rotulo: `Parcela ${i + 1}/${n}`,
    valor: (i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base).toFixed(2),
    vencimento: addDiasISO(hojeISO(), 30 * i),
  }))
}

export default function ParcelasPedidoModal({ orcamentoId, titulo, total, dataInstalacao, acrescentar, aviso, onFechar, onSalvo }: {
  orcamentoId: string
  titulo: string
  /** Valor a distribuir nas parcelas (já descontado o que foi recebido, quando for o caso) */
  total: number
  dataInstalacao: string | null
  /** true = soma às parcelas já lançadas; false = substitui as que ainda estão em aberto */
  acrescentar?: boolean
  aviso?: string
  onFechar: () => void
  onSalvo: () => void
}) {
  const [pct, setPct] = useState<number>(() => lerPct())
  const [modo, setModo] = useState<'entrada' | 'avista' | 'parcelado' | 'livre'>('entrada')
  const [nParcelas, setNParcelas] = useState(3)
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasEntradaSaldo(total, lerPct(), dataInstalacao || ''))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function aplicarModo(m: typeof modo, p = pct, n = nParcelas) {
    setModo(m)
    if (m === 'entrada') setLinhas(linhasEntradaSaldo(total, p, dataInstalacao || ''))
    if (m === 'avista') setLinhas([linha({ rotulo: 'À vista', valor: total.toFixed(2), vencimento: hojeISO() })])
    if (m === 'parcelado') setLinhas(linhasParceladas(total, n))
  }

  function editar(i: number, campo: keyof Linha, valor: string | boolean) {
    setLinhas(prev => prev.map((l, j) => j === i ? { ...l, [campo]: valor } : l))
  }
  function adicionar() {
    setModo('livre')
    setLinhas(prev => [...prev, linha({ rotulo: `Pagamento ${prev.length + 1}`, valor: Math.max(0, diferenca).toFixed(2), vencimento: hojeISO() })])
  }
  function remover(i: number) {
    setModo('livre')
    setLinhas(prev => prev.filter((_, j) => j !== i))
  }

  const soma = Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100
  const diferenca = Math.round((total - soma) * 100) / 100

  async function salvar() {
    setErro('')
    if (!linhas.length) { setErro('Inclua pelo menos um pagamento'); return }
    for (const l of linhas) {
      if (!(Number(l.valor) > 0)) { setErro('Todos os pagamentos precisam de valor'); return }
      if (!l.vencimento && !(l.acompanha_instalacao && dataInstalacao)) {
        setErro(l.acompanha_instalacao
          ? 'Sem data de instalação definida: informe um vencimento provisório (ele se ajusta sozinho quando a data de instalação for marcada)'
          : 'Todos os pagamentos precisam de data')
        return
      }
    }
    setSalvando(true)
    try {
      if (modo === 'entrada') { try { localStorage.setItem(LS_PCT, String(pct)) } catch { /* ok */ } }
      const res = await fetch('/api/financeiro/parcelas-pedido', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orcamento_id: orcamentoId,
          acrescentar: !!acrescentar,
          parcelas: linhas.map(l => ({ ...l, valor: Number(l.valor) })),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar')
      onSalvo()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9001 }}>
      <div className="modal" style={{ maxWidth: 820 }}>
        <div className="modal-header">
          <div className="modal-title">Formas de pagamento do pedido</div>
          <button className="btn-close" onClick={onFechar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 4 }}>Pedido: <b>{titulo}</b></div>
          <div style={{ fontSize: 13, marginBottom: aviso ? 6 : 16 }}>Valor a distribuir: <b>{fmt(total)}</b></div>
          {aviso && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{aviso}</div>}

          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab${modo === 'entrada' ? ' active' : ''}`} onClick={() => aplicarModo('entrada')}>Entrada + saldo na instalação</button>
            <button className={`tab${modo === 'avista' ? ' active' : ''}`} onClick={() => aplicarModo('avista')}>À vista</button>
            <button className={`tab${modo === 'parcelado' ? ' active' : ''}`} onClick={() => aplicarModo('parcelado')}>Parcelado</button>
          </div>

          {modo === 'entrada' && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label className="form-label" style={{ margin: 0 }}>ENTRADA</label>
              {[30, 40, 50, 60].map(p => (
                <button key={p} className={`btn btn-sm ${pct === p ? 'btn-gold' : 'btn-outline'}`}
                  onClick={() => { setPct(p); aplicarModo('entrada', p) }}>{p}%</button>
              ))}
            </div>
          )}
          {modo === 'parcelado' && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Nº DE PARCELAS</label>
              <input className="form-input" type="number" min={2} max={24} value={nParcelas} style={{ width: 80 }}
                onChange={e => { const n = Math.max(2, Math.min(24, Number(e.target.value) || 2)); setNParcelas(n); aplicarModo('parcelado', pct, n) }} />
              <span className="text-sm text-gray">a cada 30 dias</span>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pagamento</th>
                  <th style={{ width: 120 }}>Valor (R$)</th>
                  <th style={{ width: 150 }}>Data</th>
                  <th style={{ width: 150 }}>Forma</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Já recebido</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <input className="form-input" value={l.rotulo} onChange={e => editar(i, 'rotulo', e.target.value)} />
                      {l.acompanha_instalacao && !l.recebido && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>🔗 acompanha a data de instalação</div>
                      )}
                    </td>
                    <td><input className="form-input" type="number" step="0.01" value={l.valor} onChange={e => editar(i, 'valor', e.target.value)} /></td>
                    <td><input className="form-input" type="date" value={l.vencimento} onChange={e => editar(i, 'vencimento', e.target.value)} /></td>
                    <td>
                      <select className="form-select" value={l.forma_pagamento} onChange={e => editar(i, 'forma_pagamento', e.target.value)}>
                        <option value="">—</option>
                        {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={l.recebido} onChange={e => editar(i, 'recebido', e.target.checked)} style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} />
                    </td>
                    <td><button className="btn btn-ghost btn-sm" title="Remover" onClick={() => remover(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={adicionar}>+ Adicionar pagamento</button>

          <div style={{ marginTop: 10, fontSize: 13, color: Math.abs(diferenca) > 0.009 ? 'var(--red)' : 'var(--text-muted)' }}>
            Soma: <b>{fmt(soma)}</b>
            {Math.abs(diferenca) > 0.009 && <> — {diferenca > 0 ? 'faltam' : 'sobram'} {fmt(Math.abs(diferenca))} em relação ao valor do pedido</>}
          </div>
          {erro && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Definir depois</button>
          <button className="btn btn-gold" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e sincronizar com Contas a Receber'}</button>
        </div>
      </div>
    </div>
  )
}

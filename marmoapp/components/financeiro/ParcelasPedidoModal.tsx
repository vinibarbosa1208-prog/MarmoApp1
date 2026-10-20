'use client'

import { useState } from 'react'
import { fmt } from '@/lib/utils'
import { hojeISO, addDiasISO, dividirEntradaSaldo } from '@/lib/financeiro'

// "Como o cliente vai pagar?" — abre logo depois que o pedido é fechado
// (e também pela aba A Receber, pra pedidos sem parcelas). Padrão:
// entrada + saldo na instalação; o saldo acompanha a data de instalação
// sozinho (trigger no banco) se ela mudar depois na Fila de Serviços.

interface Linha { rotulo: string; valor: string; vencimento: string; acompanha_instalacao: boolean }

const LS_PCT = 'marmoapp.financeiro.pctEntrada'

function lerPct(): number {
  try { const v = Number(localStorage.getItem(LS_PCT)); return v > 0 && v < 100 ? v : 50 } catch { return 50 }
}

function linhasEntradaSaldo(total: number, pct: number, dataInstalacao: string): Linha[] {
  const { entrada, saldo } = dividirEntradaSaldo(total, pct)
  return [
    { rotulo: `Entrada (${pct}%)`, valor: entrada.toFixed(2), vencimento: hojeISO(), acompanha_instalacao: false },
    { rotulo: 'Saldo na instalação', valor: saldo.toFixed(2), vencimento: dataInstalacao, acompanha_instalacao: true },
  ]
}

function linhasParceladas(total: number, n: number): Linha[] {
  const base = Math.floor((total / n) * 100) / 100
  return Array.from({ length: n }, (_, i) => ({
    rotulo: `Parcela ${i + 1}/${n}`,
    valor: (i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base).toFixed(2),
    vencimento: addDiasISO(hojeISO(), 30 * i),
    acompanha_instalacao: false,
  }))
}

export default function ParcelasPedidoModal({ orcamentoId, titulo, total, dataInstalacao, acrescentar, onFechar, onSalvo }: {
  orcamentoId: string
  /** true = soma às parcelas já lançadas (só lança o que falta); false = substitui as em aberto */
  acrescentar?: boolean
  titulo: string
  total: number
  dataInstalacao: string | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [pct, setPct] = useState<number>(() => lerPct())
  const [modo, setModo] = useState<'entrada' | 'avista' | 'parcelado'>('entrada')
  const [nParcelas, setNParcelas] = useState(3)
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasEntradaSaldo(total, lerPct(), dataInstalacao || ''))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function aplicarModo(m: typeof modo, p = pct, n = nParcelas) {
    setModo(m)
    if (m === 'entrada') setLinhas(linhasEntradaSaldo(total, p, dataInstalacao || ''))
    if (m === 'avista') setLinhas([{ rotulo: 'À vista', valor: total.toFixed(2), vencimento: hojeISO(), acompanha_instalacao: false }])
    if (m === 'parcelado') setLinhas(linhasParceladas(total, n))
  }

  function editar(i: number, campo: keyof Linha, valor: string | boolean) {
    setLinhas(prev => prev.map((l, j) => j === i ? { ...l, [campo]: valor } : l))
  }

  const soma = Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100
  const diferenca = Math.round((total - soma) * 100) / 100

  async function salvar() {
    setErro('')
    for (const l of linhas) {
      if (!(Number(l.valor) > 0)) { setErro('Todas as parcelas precisam de valor'); return }
      if (!l.vencimento && !(l.acompanha_instalacao && dataInstalacao)) {
        setErro(l.acompanha_instalacao
          ? 'Sem data de instalação definida: informe um vencimento provisório (ele se ajusta sozinho quando a data de instalação for marcada)'
          : 'Todas as parcelas precisam de vencimento')
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
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar parcelas')
      onSalvo()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar parcelas')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9001 }}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div className="modal-title">Como o cliente vai pagar?</div>
          <button className="btn-close" onClick={onFechar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 4 }}>Pedido: <b>{titulo}</b></div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Total do pedido: <b>{fmt(total)}</b></div>

          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab${modo === 'entrada' ? ' active' : ''}`} onClick={() => aplicarModo('entrada')}>Entrada + saldo na instalação</button>
            <button className={`tab${modo === 'avista' ? ' active' : ''}`} onClick={() => aplicarModo('avista')}>À vista</button>
            <button className={`tab${modo === 'parcelado' ? ' active' : ''}`} onClick={() => aplicarModo('parcelado')}>Parcelado</button>
          </div>

          {modo === 'entrada' && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <thead><tr><th>Parcela</th><th style={{ width: 130 }}>Valor (R$)</th><th style={{ width: 160 }}>Vencimento</th></tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <input className="form-input" value={l.rotulo} onChange={e => editar(i, 'rotulo', e.target.value)} />
                      {l.acompanha_instalacao && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          🔗 acompanha a data de instalação
                        </div>
                      )}
                    </td>
                    <td><input className="form-input" type="number" step="0.01" value={l.valor} onChange={e => editar(i, 'valor', e.target.value)} /></td>
                    <td><input className="form-input" type="date" value={l.vencimento} onChange={e => editar(i, 'vencimento', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: Math.abs(diferenca) > 0.009 ? 'var(--red)' : 'var(--text-muted)' }}>
            Soma das parcelas: <b>{fmt(soma)}</b>
            {Math.abs(diferenca) > 0.009 && <> — {diferenca > 0 ? 'faltam' : 'sobram'} {fmt(Math.abs(diferenca))} em relação ao total</>}
          </div>
          {erro && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Pular (lançar depois)</button>
          <button className="btn btn-gold" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar em Contas a Receber'}</button>
        </div>
      </div>
    </div>
  )
}

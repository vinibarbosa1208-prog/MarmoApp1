'use client'

import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
import { type Lancamento, FORMAS_PAGAMENTO, hojeISO } from '@/lib/financeiro'

const api = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })

// ─── Modal: dar baixa ────────────────────────────────────────────────────────

export default function BaixaModal({ itens, onFechar, onSalvo }: { itens: Lancamento[]; onFechar: () => void; onSalvo: () => void }) {
  const { toast } = useApp()
  const unico = itens.length === 1 ? itens[0] : null
  const editavel = !!unico && unico.origem !== 'insumo_pedido'
  const [data, setData] = useState(hojeISO())
  const [forma, setForma] = useState(unico?.forma_pagamento || '')
  const [valor, setValor] = useState(unico ? String(unico.valor) : '')
  const [salvando, setSalvando] = useState(false)
  const receber = itens[0]?.tipo === 'receber'
  const total = itens.reduce((s, l) => s + Number(l.valor), 0)

  async function confirmar() {
    setSalvando(true)
    try {
      for (const l of itens) {
        const body: Record<string, unknown> = { status: 'pago', data_pagamento: data, forma_pagamento: forma }
        if (editavel) body.valor = valor
        const res = await api(`/api/financeiro/lancamentos/${l.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro na baixa') }
      }
      onSalvo()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro na baixa', 'err')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{receber ? 'Registrar recebimento' : 'Registrar pagamento'}</div>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, marginBottom: 14 }}>
            {unico ? <><b>{unico.descricao}</b>{unico.contraparte ? ` — ${unico.contraparte}` : ''}</> : <><b>{itens.length}</b> lançamentos — total <b>{fmt(total)}</b></>}
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">DATA</label>
              <input className="form-input" type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">FORMA</label>
              <select className="form-select" value={forma} onChange={e => setForma(e.target.value)}>
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
          </div>
          {editavel && (
            <div className="form-group">
              <label className="form-label">VALOR {receber ? 'RECEBIDO' : 'PAGO'} (R$)</label>
              <input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-gold" onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}


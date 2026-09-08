'use client'

import { useState } from 'react'

// Modal exibido automaticamente quando um pedido é fechado (CRM) ou
// aprovado, no momento em que ele entra na Fila de Corte. Pede a data
// prevista de instalação pro cliente — pode ser pulada e preenchida depois
// direto na Fila de Serviços.
export default function PrevisaoInstalacaoModal({ orcLabel, dataInicial, onCancelar, onConfirmar }: {
  orcLabel: string
  dataInicial: string
  onCancelar: () => void
  onConfirmar: (data: string) => void
}) {
  const [data, setData] = useState(dataInicial)

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Data Prevista de Instalação</div>
          <button className="btn-close" onClick={onCancelar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Pedido: <b>{orcLabel}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16, lineHeight: 1.5 }}>
            Esse pedido acabou de entrar automaticamente na <b>Fila de Corte</b>. Informe a data prevista de instalação para o cliente.
          </div>
          <div className="form-group">
            <label className="form-label">PREVISÃO DE INSTALAÇÃO (OPCIONAL)</label>
            <input className="form-input" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Pode deixar em branco e preencher depois na Fila de Serviços.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => onConfirmar('')}>Pular</button>
          <button className="btn btn-gold" onClick={() => onConfirmar(data)}>Salvar e Avançar</button>
        </div>
      </div>
    </div>
  )
}

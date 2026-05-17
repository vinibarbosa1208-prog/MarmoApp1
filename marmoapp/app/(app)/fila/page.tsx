'use client'

import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const PIPELINE = [
  { id: 'comercial',         label: 'Comercial',           cor: '#2980B9' },
  { id: 'corte',             label: 'Corte',               cor: '#8E44AD' },
  { id: 'acabamento',        label: 'Acabamento',          cor: '#E67E22' },
  { id: 'aguardando_data',   label: 'Aguardando Data',     cor: '#16A085' },
  { id: 'instalacao',        label: 'Instalação Confirmada', cor: '#27AE60' },
  { id: 'finalizado',        label: 'Finalizado',          cor: '#2C3E50' },
]

export default function FilaPage() {
  const { orcamentos, clientes, loadOrcamentos, toast } = useApp()

  const ativos = orcamentos.filter(o => o.crm_status === 'fechado' || o.producao_status)

  async function avancar(orcId: string, novoStatus: string) {
    const { error } = await supabase.from('orcamentos').update({ producao_status: novoStatus }).eq('id', orcId)
    if (error) { toast('Erro: ' + error.message, 'err'); return }
    await loadOrcamentos()
    toast('Pedido avançado!', 'ok2')
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Fila de Serviços</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0', minHeight: 400 }}>
        {PIPELINE.map((etapa, idx) => {
          const cards = ativos.filter(o => (o.producao_status || 'comercial') === etapa.id)
          const proxEtapa = idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null

          return (
            <div key={etapa.id} style={{ minWidth: 200, flex: 1, background: '#f7f7f7', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: etapa.cor, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{etapa.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {cards.length}
                </span>
              </div>

              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#ccc', fontSize: 12 }}>Nenhum pedido</div>
                ) : cards.map(o => {
                  const cli = clientes.find(c => c.id === (o.clienteId || o.cliente_id))
                  const totalVal = orcTotal(o)
                  return (
                    <div key={o.id} style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${etapa.cor}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
                        {o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{cli?.nome || '—'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: etapa.cor, marginBottom: 8 }}>{fmt(totalVal)}</div>
                      {proxEtapa ? (
                        <button
                          onClick={() => avancar(o.id, proxEtapa.id)}
                          style={{ width: '100%', background: etapa.cor, border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          → {proxEtapa.label}
                        </button>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#27AE60', fontWeight: 700 }}>✅ Concluído</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

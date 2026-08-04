'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/utils'
import { useApp } from '@/contexts/AppContext'
import LancarCustoModal from './LancarCustoModal'
import type { Projeto, ProjetoEtapa } from '@/lib/projetos/types'

const ETAPAS_SEQ: { id: ProjetoEtapa; label: string }[] = [
  { id: 'comercial', label: 'Comercial' },
  { id: 'producao', label: 'Produção' },
  { id: 'pronto', label: 'Pronto' },
  { id: 'agendado', label: 'Agendado' },
  { id: 'instalacao', label: 'Instalação' },
  { id: 'concluido', label: 'Concluído' },
]

const BREAKDOWN = [
  { key: 'custo_material' as const, label: 'Material', cor: '#2980B9' },
  { key: 'custo_mao_obra' as const, label: 'Mão de Obra', cor: '#8E44AD' },
  { key: 'custo_instalacao' as const, label: 'Instalação', cor: '#27AE60' },
  { key: 'custo_operacional' as const, label: 'Operacional', cor: '#E67E22' },
]

function margemColor(pct: number): string {
  if (pct >= 30) return 'var(--green)'
  if (pct >= 10) return '#E67E22'
  return 'var(--red)'
}

export default function ProjetoDetalhe({ id }: { id: string }) {
  const { toast } = useApp()
  const router = useRouter()
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [avancando, setAvancando] = useState(false)
  const [instalacaoPrevista, setInstalacaoPrevista] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projetos/${id}`, { credentials: 'include' })
      if (!res.ok) { router.push('/projetos'); return }
      setProjeto(await res.json())
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function deletarCusto(custoId: string) {
    const res = await fetch(`/api/projetos/${id}/custos/${custoId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) { toast('Custo removido', 'ok'); load() }
    else toast('Erro ao remover custo', 'err')
  }

  async function avancarEtapa(etapa: ProjetoEtapa) {
    setAvancando(true)
    try {
      const res = await fetch(`/api/projetos/${id}/etapas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast('Etapa avançada!', 'ok2')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao avançar', 'err')
    } finally {
      setAvancando(false)
    }
  }

  if (loading) return <div className="page-inner"><div style={{ textAlign: 'center', color: 'var(--gray)', padding: 60 }}>Carregando...</div></div>
  if (!projeto) return null

  const margem = projeto.margem_percentual ?? 0
  const cor = margemColor(margem)
  const etapas = projeto.etapas ?? []
  const etapaAtual = etapas.find(e => !e.saida_em)
  const etapaAtualIdx = etapaAtual ? ETAPAS_SEQ.findIndex(s => s.id === etapaAtual.etapa) : -1
  const proxEtapa = etapaAtualIdx >= 0 && etapaAtualIdx < ETAPAS_SEQ.length - 1
    ? ETAPAS_SEQ[etapaAtualIdx + 1]
    : null

  const custos = projeto.custos ?? []
  const outros = (projeto.custo_total ?? 0) - BREAKDOWN.reduce((s, b) => s + (projeto[b.key] ?? 0), 0)

  const orcItems = projeto.orcamento_itens ?? []
  const prevMaterial = orcItems.filter(i => i.tipo === 'material').reduce((s, i) => s + (i.custo_item ?? 0), 0)
  const prevServicos = orcItems.filter(i => i.tipo !== 'material').reduce((s, i) => s + (i.total_item ?? 0), 0)
  const totalPrevisto = prevMaterial + prevServicos + instalacaoPrevista
  const margemPrevista = projeto.valor_venda > 0
    ? Math.round(((projeto.valor_venda - totalPrevisto) / projeto.valor_venda) * 10000) / 100
    : 0
  const temPrevisto = orcItems.length > 0

  function fmtDiff(diff: number) {
    const sign = diff > 0.005 ? '+' : diff < -0.005 ? '-' : ''
    const color = diff > 0.005 ? 'var(--green)' : diff < -0.005 ? 'var(--red)' : 'var(--gray)'
    const emoji = diff > 0.005 ? '🟢' : diff < -0.005 ? '🔴' : '✅'
    return { sign, color, emoji, abs: Math.abs(diff) }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/projetos')} style={{ marginBottom: 4 }}>
            ← Projetos
          </button>
          <h1 className="page-title" style={{ marginTop: 4 }}>{projeto.titulo}</h1>
          {projeto.cliente_nome && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{projeto.cliente_nome}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {projeto.status !== 'concluido' && (
            <button className="btn btn-outline btn-sm" onClick={() => avancarEtapa('concluido')} disabled={avancando}>
              ✅ Marcar Concluído
            </button>
          )}
          <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Lançar custo</button>
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="stat-info">
            <div className="stat-value">{fmt(projeto.valor_venda)}</div>
            <div className="stat-label">Valor de venda</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div className="stat-info">
            <div className="stat-value">{fmt(projeto.custo_total ?? 0)}</div>
            <div className="stat-label">Custo total</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: cor }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: cor }}>{fmt(projeto.margem_lucro ?? 0)}</div>
            <div className="stat-label">Lucro (R$)</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: cor }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: cor, fontSize: 24 }}>{margem}%</div>
            <div className="stat-label">Margem</div>
          </div>
        </div>
      </div>

      {/* Timeline de Etapas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Etapas do Projeto</span>
          {proxEtapa && (
            <button className="btn btn-gold btn-sm" onClick={() => avancarEtapa(proxEtapa.id)} disabled={avancando}>
              {avancando ? 'Avançando...' : `→ ${proxEtapa.label}`}
            </button>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {ETAPAS_SEQ.map((etapa, idx) => {
              const registro = etapas.find(e => e.etapa === etapa.id)
              const isAtual = etapaAtual?.etapa === etapa.id
              const isConcluida = !!registro?.saida_em
              const isPendente = !registro
              return (
                <div key={etapa.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 100 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px',
                      background: isConcluida ? 'var(--green)' : isAtual ? 'var(--gold)' : 'var(--marble2)',
                      border: isAtual ? '2px solid var(--gold)' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: (isConcluida || isAtual) ? '#fff' : 'var(--gray2)',
                    }}>
                      {isConcluida ? '✓' : idx + 1}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: isAtual ? 700 : 400, color: isAtual ? 'var(--gold)' : isPendente ? 'var(--gray2)' : 'var(--dark)' }}>
                      {etapa.label}
                    </div>
                    {registro && (
                      <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 2 }}>
                        {new Date(registro.entrada_em).toLocaleDateString('pt-BR')}
                        {registro.dias_na_etapa != null && ` · ${registro.dias_na_etapa}d`}
                      </div>
                    )}
                  </div>
                  {idx < ETAPAS_SEQ.length - 1 && (
                    <div style={{ height: 2, flex: '0 0 20px', background: isConcluida ? 'var(--green)' : 'var(--marble2)' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Previsão de Custos (baseado no orçamento) */}
      {temPrevisto && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Previsão de Custos (baseado no orçamento)</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--marble2)', fontSize: 14 }}>
                <span style={{ color: 'var(--gray)' }}>Material</span>
                <strong style={{ fontFamily: 'monospace' }}>{fmt(prevMaterial)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--marble2)', fontSize: 14 }}>
                <span style={{ color: 'var(--gray)' }}>Serviços</span>
                <strong style={{ fontFamily: 'monospace' }}>{fmt(prevServicos)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--marble2)', fontSize: 14 }}>
                <span style={{ color: 'var(--gray)' }}>Instalação</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={instalacaoPrevista || ''}
                  placeholder="0,00"
                  onChange={e => setInstalacaoPrevista(parseFloat(e.target.value) || 0)}
                  style={{ width: 120, textAlign: 'right', border: '1px solid var(--marble2)', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ borderTop: '1px solid var(--marble2)', marginTop: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>Total prev.</span>
                  <strong style={{ fontFamily: 'monospace' }}>{fmt(totalPrevisto)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 10px', fontSize: 14 }}>
                  <span style={{ color: 'var(--gray)' }}>Valor de venda</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--blue)' }}>{fmt(projeto.valor_venda)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid var(--gold)', fontSize: 15 }}>
                  <span style={{ fontWeight: 700 }}>Margem prevista</span>
                  <strong style={{ color: margemColor(margemPrevista) }}>{margemPrevista}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativo Previsto × Realizado */}
      {temPrevisto && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Previsto × Realizado</span>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ fontSize: 12, color: 'var(--gray)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}></th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', fontWeight: 600 }}>Previsto</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', fontWeight: 600 }}>Realizado</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', fontWeight: 600 }}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Material', prev: prevMaterial, real: projeto.custo_material ?? 0 },
                  { label: 'Serviços', prev: prevServicos, real: projeto.custo_mao_obra ?? 0 },
                  { label: 'Instalação', prev: instalacaoPrevista, real: projeto.custo_instalacao ?? 0 },
                ].map(row => {
                  const { sign, color, emoji, abs } = fmtDiff(row.prev - row.real)
                  return (
                    <tr key={row.label} style={{ borderTop: '1px solid var(--marble2)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 500 }}>{row.label}:</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(row.prev)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(row.real)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>
                        <span style={{ color, fontWeight: 600 }}>{sign}{fmt(abs)} {emoji}</span>
                      </td>
                    </tr>
                  )
                })}
                {(() => {
                  const { sign, color, emoji, abs } = fmtDiff(totalPrevisto - (projeto.custo_total ?? 0))
                  return (
                    <tr style={{ borderTop: '2px solid var(--dark)', fontWeight: 700 }}>
                      <td style={{ padding: '10px 0' }}>TOTAL:</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(totalPrevisto)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(projeto.custo_total ?? 0)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>
                        <span style={{ color, fontWeight: 700 }}>{sign}{fmt(abs)} {emoji}</span>
                      </td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--gray)', borderTop: '1px solid var(--marble2)', paddingTop: 10 }}>
              Lucro real:{' '}
              <strong style={{ color: margemColor(margem) }}>{fmt(projeto.margem_lucro ?? 0)}</strong>
              <span style={{ marginLeft: 8 }}>(margem: <strong style={{ color: margemColor(margem) }}>{margem}%</strong>)</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Breakdown por categoria */}
        <div className="card">
          <div className="card-header"><span className="card-title">Por categoria</span></div>
          <div className="card-body">
            {(projeto.custo_total ?? 0) === 0 && (
              <div style={{ color: 'var(--gray)', fontSize: 13 }}>Sem custos lançados</div>
            )}
            {BREAKDOWN.map(b => {
              const val = projeto[b.key] ?? 0
              if (val === 0) return null
              const pct = (projeto.custo_total ?? 0) > 0 ? (val / (projeto.custo_total ?? 1)) * 100 : 0
              return (
                <div key={b.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.cor, display: 'inline-block' }} />
                      {b.label}
                    </span>
                    <strong>{fmt(val)}</strong>
                  </div>
                  <div style={{ height: 5, background: 'var(--marble2)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: b.cor, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
            {outros > 0.01 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#95A5A6', display: 'inline-block' }} />
                    Outros
                  </span>
                  <strong>{fmt(outros)}</strong>
                </div>
                <div style={{ height: 5, background: 'var(--marble2)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(projeto.custo_total ?? 0) > 0 ? (outros / (projeto.custo_total ?? 1)) * 100 : 0}%`, background: '#95A5A6', borderRadius: 3 }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabela de lançamentos */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Lançamentos</span>
            <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>+ Lançar</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {custos.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 12, color: 'var(--gray)' }}>
                      {new Date(c.data + 'T00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      {c.descricao}
                      {c.origem === 'automatico' && (
                        <span
                          title="Calculado automaticamente a partir da produção real registrada na Fila de Serviços"
                          style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '2px 6px', borderRadius: 4 }}
                        >
                          🤖 automático
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 500, color: BREAKDOWN.find(b => b.key === `custo_${c.tipo}`)?.cor ?? '#95A5A6' }}>
                        {c.tipo === 'mao_obra' ? 'Mão de Obra' : c.tipo === 'outros' ? 'Outros' :
                          c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.valor)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--red)' }}
                        onClick={() => deletarCusto(c.id)} title="Remover">✕</button>
                    </td>
                  </tr>
                ))}
                {custos.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray)', padding: '20px 0' }}>Nenhum custo lançado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <LancarCustoModal
          projectId={id}
          onClose={() => setShowModal(false)}
          onSaved={load}
          toast={toast}
        />
      )}
    </div>
  )
}

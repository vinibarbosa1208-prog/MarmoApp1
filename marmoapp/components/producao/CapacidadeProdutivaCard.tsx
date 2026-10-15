'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmt as fmtMoeda } from '@/lib/utils'
import { MIN_DIAS_CONFIAVEL, LABEL_ETAPA, type ProdutividadePessoa, type FilaEtapa, type CustoUnitario } from '@/lib/capacidade'
import type { EtapaProducao } from '@/lib/producao/pessoas'

// Card "🏭 Capacidade produtiva" do relatório — tudo calculado no servidor
// (GET /api/producao/capacidade, que usa lib/capacidade.ts) porque a conta
// varre apontamentos, presença e a carteira inteira de peças. Substitui o
// bloco antigo de PCP que calculava aqui no cliente a partir de
// producao_apontamentos + funcionario_instalacoes direto — agora o
// relatório de PCP usa a capacidade MEDIDA, como pede a spec.

interface CapacidadeResponse {
  janela: { inicio: string; fim: string }
  fator_meia_esquadria: number
  fator_me_sugerido: number | null
  produtividades: ProdutividadePessoa[]
  capacidade: Record<EtapaProducao, { porDia: number; pessoas: number; pessoasComPoucoDado: number }>
  carteira: { corte: number; acabamento: number; instalacao: number; pedidos: number }
  filas: FilaEtapa[]
  gargalo: FilaEtapa | null
  prazo: { diasUteis: number; data: string; gargalo: EtapaProducao } | null
  custos: { corte: CustoUnitario; acabamento: CustoUnitario; instalacao: CustoUnitario }
  mes: {
    periodo: { inicio: string; fim: string }
    vendido: { m2: number; ml: number }
    produzido: { m2: number; mlEq: number }
    entregue: { ml: number }
  }
}

function fmtN(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtData(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function CapacidadeProdutivaCard() {
  const [data, setData] = useState<CapacidadeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mesRef, setMesRef] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`/api/producao/capacidade?mes=${mesRef}`, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErro(d.error || 'Erro ao carregar os indicadores')
        return
      }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [mesRef])

  useEffect(() => { carregar() }, [carregar])

  function mudarMes(delta: number) {
    const [ano, mes] = mesRef.split('-').map(Number)
    const d = new Date(ano, mes - 1 + delta, 1)
    setMesRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const temDados = !!data && (
    data.produtividades.length > 0 || data.carteira.pedidos > 0
  )

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header"><span className="card-title">🏭 Capacidade Produtiva</span></div>
      <div className="card-body">
        {loading && !data ? (
          <div style={{ padding: 12, color: 'var(--gray)', fontSize: 13 }}>Carregando…</div>
        ) : erro ? (
          <div style={{ padding: 12, color: 'var(--red)', fontSize: 13 }}>{erro}</div>
        ) : !data || !temDados ? (
          <div style={{ padding: 12, color: 'var(--gray)', fontSize: 13 }}>
            Ainda sem dados suficientes. Assim que a ficha semanal começar a registrar corte, acabamento e instalação, os indicadores aparecem aqui automaticamente.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 16 }}>
              Médias das últimas 4 semanas ({fmtData(data.janela.inicio)} a {fmtData(data.janela.fim)})
            </div>

            {/* Capacidade do time */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
              {(['corte', 'acabamento', 'instalacao'] as EtapaProducao[]).map(etapa => {
                const cap = data.capacidade[etapa]
                return (
                  <div key={etapa}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>
                      {LABEL_ETAPA[etapa]}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {cap.porDia > 0 ? `${fmtN(cap.porDia)} ${etapa === 'corte' ? 'm²/dia' : 'ml/dia'}` : '—'}
                    </div>
                    {cap.pessoas > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {cap.pessoas} pessoa{cap.pessoas !== 1 ? 's' : ''}
                        {cap.pessoasComPoucoDado > 0 && `, ${cap.pessoasComPoucoDado} com poucos dias de dado`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Carteira e fila */}
            {data.filas.some(f => f.carteira > 0) && (
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Carteira — {data.carteira.pedidos} pedido{data.carteira.pedidos !== 1 ? 's' : ''} em aberto
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  {data.filas.filter(f => f.carteira > 0).map(f => (
                    <div key={f.etapa}>
                      {LABEL_ETAPA[f.etapa]}: <strong>{fmtN(f.carteira)} {f.unidade}</strong> pendentes
                      {f.diasUteis !== null ? (
                        <> → cerca de <strong>{f.diasUteis} dia{f.diasUteis !== 1 ? 's' : ''} úteis</strong> pra zerar no ritmo atual</>
                      ) : (
                        <span style={{ color: 'var(--gray)' }}> — sem capacidade medida ainda pra estimar</span>
                      )}
                    </div>
                  ))}
                </div>
                {data.gargalo && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    Gargalo: <strong style={{ color: 'var(--gold)' }}>{LABEL_ETAPA[data.gargalo.etapa]}</strong>
                    {data.prazo && (
                      <> — se fechar um pedido hoje, prazo estimado de <strong>{data.prazo.diasUteis} dia{data.prazo.diasUteis !== 1 ? 's' : ''} úteis</strong> (entrega em torno de {fmtData(data.prazo.data)})</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custos */}
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>Custo de mão de obra medido</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                <CustoTile label="Custo por m² cortado" custo={data.custos.corte} />
                <CustoTile label="Custo por ml acabado" custo={data.custos.acabamento} />
                <CustoTile label="Custo por ml instalado" custo={data.custos.instalacao} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>
                Fator meia esquadria em uso: <strong>{fmtN(data.fator_meia_esquadria, 2)}</strong>
                {data.fator_me_sugerido !== null && (
                  <> — sugestão com os dados medidos: <strong>{fmtN(data.fator_me_sugerido, 2)}</strong> (ajuste em Configurações se confirmar)</>
                )}
              </div>
            </div>

            {/* Produtividade por pessoa */}
            {data.produtividades.length > 0 && (
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Produtividade por pessoa
                </div>
                <table>
                  <thead><tr><th>Nome</th><th>Etapa</th><th>Média/dia</th><th>Dias de dado</th></tr></thead>
                  <tbody>
                    {data.produtividades.map(p => (
                      <tr key={p.pessoaId + p.etapa} style={p.dadosInsuficientes ? { color: 'var(--gray)' } : undefined}>
                        <td style={{ fontWeight: 500 }}>{p.nome}</td>
                        <td className="text-sm">{LABEL_ETAPA[p.etapa]}</td>
                        <td className="font-bold">{fmtN(p.mediaDia)} {p.unidade}</td>
                        <td className="text-sm">
                          {p.dias} {p.base === 'apontamentos' && '(sem presença)'}
                          {p.dadosInsuficientes && <span title={`Menos de ${MIN_DIAS_CONFIAVEL} dias de dados`}> ⓘ dados insuficientes</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Vendido x Produzido x Entregue */}
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>
                  Vendido × Produzido × Entregue
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => mudarMes(-1)}>‹</button>
                <span style={{ fontSize: 12, color: 'var(--gray)' }}>
                  {new Date(mesRef + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => mudarMes(1)}>›</button>
              </div>
              <table>
                <thead><tr><th></th><th>Material (m²)</th><th>Acabamento (ml)</th></tr></thead>
                <tbody>
                  <tr><td style={{ fontWeight: 500 }}>Vendido</td><td>{fmtN(data.mes.vendido.m2)}</td><td>{fmtN(data.mes.vendido.ml)}</td></tr>
                  <tr><td style={{ fontWeight: 500 }}>Produzido</td><td>{fmtN(data.mes.produzido.m2)}</td><td>{fmtN(data.mes.produzido.mlEq)} ml eq.</td></tr>
                  <tr><td style={{ fontWeight: 500 }}>Entregue (instalado)</td><td>—</td><td>{fmtN(data.mes.entregue.ml)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CustoTile({ label, custo }: { label: string; custo: CustoUnitario }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{custo.valor !== null ? `${fmtMoeda(custo.valor)}` : '—'}</div>
      {custo.dias > 0 && <div style={{ fontSize: 11, color: 'var(--gray)' }}>{custo.dias} dia{custo.dias !== 1 ? 's' : ''} com dado</div>}
    </div>
  )
}

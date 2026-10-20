'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
import {
  type Lancamento, type Recorrencia, type TipoLancamento,
  CATEGORIAS_RECEBER, CATEGORIAS_PAGAR, ORIGEM_LABEL, FORMAS_PAGAMENTO,
  hojeISO, addDiasISO, situacao,
} from '@/lib/financeiro'
import ParcelasPedidoModal from '@/components/financeiro/ParcelasPedidoModal'
import BaixaModal from '@/components/financeiro/BaixaModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const api = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

type Periodo = 'mes' | 'prox30' | 'prox90' | 'mes_ant' | 'tudo'
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: 'prox30', label: 'Próximos 30 dias' },
  { id: 'prox90', label: 'Próximos 90 dias' },
  { id: 'mes_ant', label: 'Mês passado' },
  { id: 'tudo', label: 'Tudo' },
]

function intervalo(p: Periodo): [string, string] {
  const hoje = hojeISO()
  const [y, m] = hoje.split('-').map(Number)
  const ultimoDia = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (p === 'mes') return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(ultimoDia(y, m))}`]
  if (p === 'mes_ant') {
    const yy = m === 1 ? y - 1 : y, mm = m === 1 ? 12 : m - 1
    return [`${yy}-${pad(mm)}-01`, `${yy}-${pad(mm)}-${pad(ultimoDia(yy, mm))}`]
  }
  if (p === 'prox30') return [hoje, addDiasISO(hoje, 30)]
  if (p === 'prox90') return [hoje, addDiasISO(hoje, 90)]
  return ['0000-01-01', '9999-12-31']
}

function SituacaoBadge({ l }: { l: Lancamento }) {
  const s = situacao(l)
  const receber = l.tipo === 'receber'
  if (s === 'pago') return <span className="badge badge-ok">{receber ? 'Recebido' : 'Pago'}</span>
  if (s === 'cancelado') return <span className="badge badge-draft">Cancelado</span>
  if (s === 'vencido') return <span className="badge badge-low">Vencido</span>
  if (s === 'hoje') return <span className="badge badge-expired">Vence hoje</span>
  return <span className="badge badge-sent">Em aberto</span>
}

const categorias = (tipo: TipoLancamento) => tipo === 'receber' ? CATEGORIAS_RECEBER : CATEGORIAS_PAGAR

// ─── Modal: novo / editar lançamento ─────────────────────────────────────────

function LancamentoModal({ tipo, inicial, origem, onFechar, onSalvo }: {
  tipo: TipoLancamento
  inicial?: Lancamento | null
  origem?: 'manual' | 'compra_programada'
  onFechar: () => void
  onSalvo: () => void
}) {
  const { toast } = useApp()
  const editando = !!inicial
  const sincronizado = inicial?.origem === 'insumo_pedido' || inicial?.origem === 'funcionario_pagamento'
  const [f, setF] = useState({
    descricao: inicial?.descricao ?? '',
    contraparte: inicial?.contraparte ?? '',
    categoria: inicial?.categoria ?? (origem === 'compra_programada' ? 'material' : tipo === 'receber' ? 'venda' : 'outros'),
    valor: inicial ? String(inicial.valor) : '',
    vencimento: inicial?.vencimento ?? hojeISO(),
    parcelas: '1',
    jaPago: false,
    forma_pagamento: inicial?.forma_pagamento ?? '',
    observacao: inicial?.observacao ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }))

  async function salvar() {
    setSalvando(true)
    try {
      const res = editando
        ? await api(`/api/financeiro/lancamentos/${inicial!.id}`, {
            method: 'PATCH',
            body: JSON.stringify(sincronizado
              ? { vencimento: f.vencimento, observacao: f.observacao, forma_pagamento: f.forma_pagamento }
              : { descricao: f.descricao, contraparte: f.contraparte, categoria: f.categoria, valor: f.valor,
                  vencimento: f.vencimento, observacao: f.observacao, forma_pagamento: f.forma_pagamento }),
          })
        : await api('/api/financeiro/lancamentos', {
            method: 'POST',
            body: JSON.stringify({
              tipo, origem: origem || 'manual', descricao: f.descricao, contraparte: f.contraparte,
              categoria: f.categoria, valor: f.valor, vencimento: f.vencimento, parcelas: f.parcelas,
              status: f.jaPago ? 'pago' : 'previsto', forma_pagamento: f.forma_pagamento, observacao: f.observacao,
            }),
          })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar')
      onSalvo()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSalvando(false)
    }
  }

  const titulo = editando ? 'Editar lançamento'
    : origem === 'compra_programada' ? 'Programar compra'
    : tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'
  const multi = !editando && Number(f.parcelas) > 1

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">{titulo}</div>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          {sincronizado && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Este lançamento vem de <b>{ORIGEM_LABEL[inicial!.origem]}</b>: valor e descrição seguem o cadastro de origem. Aqui dá pra ajustar o vencimento e a observação.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">DESCRIÇÃO</label>
            <input className="form-input" value={f.descricao} disabled={sincronizado} onChange={e => set('descricao', e.target.value)}
              placeholder={tipo === 'receber' ? 'Ex.: Serviço avulso — conserto de pia' : 'Ex.: Chapa Preto São Gabriel 2cm'} />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">{tipo === 'receber' ? 'CLIENTE' : 'FORNECEDOR / FAVORECIDO'}</label>
              <input className="form-input" value={f.contraparte} disabled={sincronizado} onChange={e => set('contraparte', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CATEGORIA</label>
              <select className="form-select" value={f.categoria} disabled={sincronizado} onChange={e => set('categoria', e.target.value)}>
                {Object.entries(categorias(tipo)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">VALOR {multi ? 'TOTAL ' : ''}(R$)</label>
              <input className="form-input" type="number" step="0.01" value={f.valor} disabled={sincronizado} onChange={e => set('valor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{multi ? '1º VENCIMENTO' : 'VENCIMENTO'}</label>
              <input className="form-input" type="date" value={f.vencimento} onChange={e => set('vencimento', e.target.value)} />
            </div>
            {!editando && (
              <div className="form-group">
                <label className="form-label">PARCELAS (MENSAIS)</label>
                <input className="form-input" type="number" min={1} max={60} value={f.parcelas} onChange={e => set('parcelas', e.target.value)} />
              </div>
            )}
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">FORMA DE PAGAMENTO</label>
              <select className="form-select" value={f.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)}>
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
            {!editando && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.jaPago} onChange={e => set('jaPago', e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
                  {tipo === 'receber' ? 'Já recebido' : 'Já pago'}{multi ? ' (1ª parcela)' : ''}
                </label>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">OBSERVAÇÃO</label>
            <textarea className="form-textarea" rows={2} value={f.observacao} onChange={e => set('observacao', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba: A Receber / A Pagar ────────────────────────────────────────────────

type FiltroStatus = 'aberto' | 'vencido' | 'pago' | 'todos'

interface PedidoParcelas {
  id: string; numero: number | null; titulo: string | null; total: number
  data_prevista_instalacao: string | null; cliente_nome: string | null; total_lancado: number
}

function AbaLancamentos({ tipo, lancamentos, periodo, recarregar }: {
  tipo: TipoLancamento; lancamentos: Lancamento[]; periodo: Periodo; recarregar: () => void
}) {
  const { toast } = useApp()
  const [filtro, setFiltro] = useState<FiltroStatus>('aberto')
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modalNovo, setModalNovo] = useState(false)
  const [editar, setEditar] = useState<Lancamento | null>(null)
  const [baixa, setBaixa] = useState<Lancamento[] | null>(null)
  const [pedidos, setPedidos] = useState<PedidoParcelas[]>([])
  const [parcelasDe, setParcelasDe] = useState<PedidoParcelas | null>(null)
  const [verPedidos, setVerPedidos] = useState(false)
  const receber = tipo === 'receber'

  const carregarPedidos = useCallback(async () => {
    if (!receber) return
    const res = await api('/api/financeiro/parcelas-pedido')
    if (res.ok) setPedidos(await res.json())
  }, [receber])
  useEffect(() => { carregarPedidos() }, [carregarPedidos])

  const pedidosSemParcelas = pedidos.filter(p => Number(p.total) - Number(p.total_lancado) > 0.01)

  const [de, ate] = intervalo(periodo)
  const hoje = hojeISO()
  const visiveis = useMemo(() => lancamentos.filter(l => {
    if (l.tipo !== tipo) return false
    const s = situacao(l, hoje)
    const noPeriodo = l.vencimento >= de && l.vencimento <= ate
    const atrasadoAntes = l.status === 'previsto' && l.vencimento < de
    const dataPago = l.data_pagamento || l.vencimento
    if (filtro === 'aberto' && !(l.status === 'previsto' && (noPeriodo || atrasadoAntes))) return false
    if (filtro === 'vencido' && s !== 'vencido') return false
    if (filtro === 'pago' && !(s === 'pago' && dataPago >= de && dataPago <= ate)) return false
    if (filtro === 'todos' && !(noPeriodo || atrasadoAntes)) return false
    if (categoria && l.categoria !== categoria) return false
    if (busca) {
      const b = busca.toLowerCase()
      if (!`${l.descricao} ${l.contraparte || ''} ${l.observacao || ''}`.toLowerCase().includes(b)) return false
    }
    return true
  }), [lancamentos, tipo, filtro, categoria, busca, de, ate, hoje])

  const totalVisivel = visiveis.filter(l => l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0)
  const selecionados = visiveis.filter(l => sel.has(l.id))
  const toggle = (id: string) => setSel(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function acao(l: Lancamento, metodo: 'PATCH' | 'DELETE', body: Record<string, unknown> | null, pergunta: string, ok: string) {
    if (!confirm(pergunta)) return
    const res = await api(`/api/financeiro/lancamentos/${l.id}`, { method: metodo, body: body ? JSON.stringify(body) : undefined })
    if (res.ok) { toast(ok, 'ok2'); recarregar(); carregarPedidos() }
    else { const d = await res.json(); toast(d.error || 'Erro', 'err') }
  }

  const COLS = 8
  return (
    <div>
      {receber && pedidosSemParcelas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--gold)' }}>
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setVerPedidos(v => !v)}>
            <span className="card-title">
              ⚠️ {pedidosSemParcelas.length} pedido(s) aprovado(s) sem parcelas lançadas — {fmt(pedidosSemParcelas.reduce((s, p) => s + Number(p.total) - Number(p.total_lancado), 0))} fora da previsão
            </span>
            <button className="btn btn-ghost btn-sm">{verPedidos ? 'Ocultar' : 'Ver pedidos'}</button>
          </div>
          {verPedidos && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Instalação prevista</th><th>Total</th><th>Já lançado</th><th></th></tr></thead>
                <tbody>
                  {pedidosSemParcelas.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>#{p.numero} {p.titulo ? `— ${p.titulo}` : ''}</td>
                      <td className="text-sm">{p.cliente_nome || '—'}</td>
                      <td className="text-sm">{fmtDate(p.data_prevista_instalacao)}</td>
                      <td className="font-bold">{fmt(p.total)}</td>
                      <td className="text-sm">{p.total_lancado > 0 ? fmt(p.total_lancado) : '—'}</td>
                      <td><button className="btn btn-gold btn-sm" onClick={() => setParcelasDe(p)}>Lançar parcelas</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selecionados.length > 0 && (
        <div style={{ background: 'var(--sidebar-bg)', color: '#fff', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selecionados.length} selecionado(s) — {fmt(selecionados.reduce((s, l) => s + Number(l.valor), 0))}</span>
          <button className="btn btn-gold btn-sm" onClick={() => setBaixa(selecionados)}>{receber ? '💰 Marcar como recebido' : '💰 Marcar como pago'}</button>
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }} onClick={() => setSel(new Set())}>Limpar</button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" style={{ width: 'auto' }} value={filtro} onChange={e => { setFiltro(e.target.value as FiltroStatus); setSel(new Set()) }}>
              <option value="aberto">Em aberto (inclui vencidos)</option>
              <option value="vencido">Só vencidos</option>
              <option value="pago">{receber ? 'Recebidos' : 'Pagos'} no período</option>
              <option value="todos">Todos do período</option>
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {Object.entries(categorias(tipo)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="form-input" style={{ width: 200 }} placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn btn-gold" onClick={() => setModalNovo(true)}>+ {receber ? 'Nova conta a receber' : 'Nova conta a pagar'}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Vencimento</th>
                <th>Descrição</th>
                <th>{receber ? 'Cliente' : 'Fornecedor / favorecido'}</th>
                <th>Categoria</th>
                <th className="text-right">Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr><td colSpan={COLS}><div className="empty-state"><p>Nenhum lançamento nesse filtro.</p></div></td></tr>
              ) : visiveis.map(l => {
                const s = situacao(l, hoje)
                const daEquipe = l.origem === 'funcionario_pagamento'
                const podeExcluir = l.origem === 'manual' || l.origem === 'compra_programada' || l.origem === 'orcamento'
                return (
                  <tr key={l.id} style={{ opacity: l.status === 'cancelado' ? 0.5 : 1 }}>
                    <td>
                      {l.status === 'previsto' && !daEquipe && (
                        <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} style={{ cursor: 'pointer', accentColor: 'var(--gold)' }} />
                      )}
                    </td>
                    <td className="text-sm" style={{ color: s === 'vencido' ? 'var(--red)' : undefined, whiteSpace: 'nowrap' }}>
                      {fmtDate(l.vencimento)}
                      {l.acompanha_instalacao && l.status === 'previsto' && <div title="Acompanha a data de instalação" style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔗 instalação</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{l.descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {ORIGEM_LABEL[l.origem]}
                        {l.status === 'pago' && l.data_pagamento ? ` · ${receber ? 'recebido' : 'pago'} em ${fmtDate(l.data_pagamento)}` : ''}
                        {l.forma_pagamento ? ` · ${l.forma_pagamento}` : ''}
                      </div>
                    </td>
                    <td className="text-sm">{l.contraparte || '—'}</td>
                    <td className="text-sm">{categorias(tipo)[l.categoria] || l.categoria}</td>
                    <td className="text-right font-bold" style={{ whiteSpace: 'nowrap' }}>
                      {Number(l.valor) > 0 ? fmt(l.valor) : <span className="text-gray text-sm">a definir</span>}
                    </td>
                    <td><SituacaoBadge l={l} /></td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        {l.status === 'previsto' && !daEquipe && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setBaixa([l])}>{receber ? '✅ Receber' : '💰 Pagar'}</button>
                        )}
                        {l.status !== 'previsto' && !daEquipe && (
                          <button className="btn btn-ghost btn-sm" onClick={() => acao(l, 'PATCH', { status: 'previsto' }, `Voltar "${l.descricao}" para em aberto?`, 'Lançamento reaberto')}>↩ Reabrir</button>
                        )}
                        {!daEquipe && (
                          <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setEditar(l)}>✏️</button>
                        )}
                        {l.status === 'previsto' && l.origem === 'recorrencia' && (
                          <button className="btn btn-ghost btn-sm" title="Pular este mês" onClick={() => acao(l, 'PATCH', { status: 'cancelado' }, `Pular "${l.descricao}" neste mês?`, 'Mês pulado')}>⊘</button>
                        )}
                        {podeExcluir && l.status !== 'pago' && (
                          <button className="btn btn-ghost btn-sm" title="Excluir" onClick={() => acao(l, 'DELETE', null, `Excluir "${l.descricao}"? Não dá pra desfazer.`, 'Lançamento excluído')}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {visiveis.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right text-sm" style={{ fontWeight: 600 }}>Total ({visiveis.length})</td>
                  <td className="text-right font-bold">{fmt(totalVisivel)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modalNovo && <LancamentoModal tipo={tipo} onFechar={() => setModalNovo(false)} onSalvo={() => { setModalNovo(false); recarregar(); toast('Lançamento criado', 'ok2') }} />}
      {editar && <LancamentoModal tipo={tipo} inicial={editar} onFechar={() => setEditar(null)} onSalvo={() => { setEditar(null); recarregar(); toast('Lançamento atualizado', 'ok2') }} />}
      {baixa && <BaixaModal itens={baixa} onFechar={() => setBaixa(null)} onSalvo={() => { setBaixa(null); setSel(new Set()); recarregar(); toast(receber ? 'Recebimento registrado' : 'Pagamento registrado', 'ok2') }} />}
      {parcelasDe && (
        <ParcelasPedidoModal
          orcamentoId={parcelasDe.id}
          titulo={`#${parcelasDe.numero}${parcelasDe.cliente_nome ? ' — ' + parcelasDe.cliente_nome : ''}`}
          total={Math.round((Number(parcelasDe.total) - Number(parcelasDe.total_lancado)) * 100) / 100}
          dataInstalacao={parcelasDe.data_prevista_instalacao}
          acrescentar={Number(parcelasDe.total_lancado) > 0}
          onFechar={() => setParcelasDe(null)}
          onSalvo={() => { setParcelasDe(null); recarregar(); carregarPedidos(); toast('Parcelas lançadas', 'ok2') }}
        />
      )}
    </div>
  )
}

// ─── Aba: Compras futuras ────────────────────────────────────────────────────

interface Sugestao {
  chave: string; tipo: 'material' | 'insumo'; descricao: string; detalhe: string
  quantidade: number; unidade: string; valor_sugerido: number; vencimento_sugerido: string; orcamento_id: string | null
}

const LS_IGNORADAS = 'marmoapp.financeiro.sugestoesIgnoradas'

function AbaComprasFuturas({ lancamentos, recarregar }: { lancamentos: Lancamento[]; recarregar: () => void }) {
  const { toast } = useApp()
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, { valor: string; vencimento: string }>>({})
  const [ignoradas, setIgnoradas] = useState<string[]>([])
  const [modalManual, setModalManual] = useState(false)

  useEffect(() => {
    try { setIgnoradas(JSON.parse(localStorage.getItem(LS_IGNORADAS) || '[]')) } catch { /* ok */ }
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await api('/api/financeiro/sugestoes-compra')
    if (res.ok) setSugestoes(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function ignorar(chave: string) {
    const n = [...ignoradas, chave]
    setIgnoradas(n)
    try { localStorage.setItem(LS_IGNORADAS, JSON.stringify(n)) } catch { /* ok */ }
  }

  async function programar(s: Sugestao) {
    const e = edits[s.chave] || { valor: String(s.valor_sugerido || ''), vencimento: s.vencimento_sugerido }
    if (!(Number(e.valor) > 0)) { toast('Informe o valor da compra', 'err'); return }
    const res = await api('/api/financeiro/lancamentos', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'pagar', origem: 'compra_programada',
        categoria: s.tipo === 'material' ? 'material' : 'insumos',
        descricao: `Compra: ${s.descricao} (${s.quantidade.toLocaleString('pt-BR')} ${s.unidade})`,
        observacao: s.detalhe, valor: e.valor, vencimento: e.vencimento,
        sugestao_chave: s.chave, orcamento_id: s.orcamento_id,
      }),
    })
    if (res.ok) { toast('Compra programada em Contas a Pagar', 'ok2'); carregar(); recarregar() }
    else { const d = await res.json(); toast(d.error || 'Erro', 'err') }
  }

  const visiveis = sugestoes.filter(s => !ignoradas.includes(s.chave))
  const programadas = lancamentos.filter(l => l.origem === 'compra_programada' && l.status === 'previsto')

  const tabelaSugestoes = (tipo: 'material' | 'insumo', titulo: string, vazio: string) => {
    const lista = visiveis.filter(s => s.tipo === tipo)
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">{titulo}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Quantidade</th><th style={{ width: 140 }}>Valor (R$)</th><th style={{ width: 160 }}>Pagar em</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}><div className="empty-state"><p>Calculando…</p></div></td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><p>{vazio}</p></div></td></tr>
              ) : lista.map(s => {
                const e = edits[s.chave] || { valor: String(s.valor_sugerido || ''), vencimento: s.vencimento_sugerido }
                const setE = (k: 'valor' | 'vencimento', v: string) => setEdits(p => ({ ...p, [s.chave]: { ...e, [k]: v } }))
                return (
                  <tr key={s.chave}>
                    <td><div style={{ fontWeight: 500 }}>{s.descricao}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.detalhe}</div></td>
                    <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{s.quantidade.toLocaleString('pt-BR')} {s.unidade}</td>
                    <td><input className="form-input" type="number" step="0.01" value={e.valor} onChange={ev => setE('valor', ev.target.value)} /></td>
                    <td><input className="form-input" type="date" value={e.vencimento} onChange={ev => setE('vencimento', ev.target.value)} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-gold btn-sm" onClick={() => programar(s)}>Programar</button>
                        <button className="btn btn-ghost btn-sm" title="Não preciso comprar" onClick={() => ignorar(s.chave)}>Ignorar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640 }}>
          Sugestões calculadas a partir dos pedidos aprovados que ainda não foram cortados (custo de material do orçamento) e dos insumos abaixo do estoque mínimo. Ajuste valor e data e clique em <b>Programar</b> — a compra entra em Contas a Pagar.
        </div>
        <button className="btn btn-gold" onClick={() => setModalManual(true)}>+ Programar compra manual</button>
      </div>

      {tabelaSugestoes('material', '🪨 Material para pedidos aprovados', 'Nenhum pedido aprovado aguardando material.')}
      {tabelaSugestoes('insumo', '📦 Insumos abaixo do mínimo', 'Todos os insumos estão acima do estoque mínimo (ou já têm pedido em aberto).')}

      <div className="card">
        <div className="card-header"><span className="card-title">🗓️ Compras já programadas (em aberto)</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pagar em</th><th>Compra</th><th>Fornecedor</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {programadas.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><p>Nenhuma compra programada.</p></div></td></tr>
              ) : programadas.map(l => (
                <tr key={l.id}>
                  <td className="text-sm">{fmtDate(l.vencimento)}</td>
                  <td><div style={{ fontWeight: 500 }}>{l.descricao}</div>{l.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.observacao}</div>}</td>
                  <td className="text-sm">{l.contraparte || '—'}</td>
                  <td className="text-right font-bold">{fmt(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalManual && (
        <LancamentoModal tipo="pagar" origem="compra_programada"
          onFechar={() => setModalManual(false)}
          onSalvo={() => { setModalManual(false); recarregar(); toast('Compra programada', 'ok2') }} />
      )}
    </div>
  )
}

// ─── Aba: Despesas fixas ─────────────────────────────────────────────────────

function RecorrenciaModal({ inicial, onFechar, onSalvo }: { inicial: Recorrencia | null; onFechar: () => void; onSalvo: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({
    descricao: inicial?.descricao ?? '',
    contraparte: inicial?.contraparte ?? '',
    categoria: inicial?.categoria ?? 'despesa_fixa',
    valor: inicial ? String(inicial.valor) : '',
    dia_vencimento: inicial ? String(inicial.dia_vencimento) : '10',
    inicio: inicial?.inicio ?? hojeISO(),
    fim: inicial?.fim ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  async function salvar() {
    setSalvando(true)
    try {
      const res = inicial
        ? await api(`/api/financeiro/recorrencias/${inicial.id}`, { method: 'PATCH', body: JSON.stringify(f) })
        : await api('/api/financeiro/recorrencias', { method: 'POST', body: JSON.stringify(f) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar')
      onSalvo()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">{inicial ? 'Editar despesa fixa' : 'Nova despesa fixa'}</div>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">DESCRIÇÃO</label>
            <input className="form-input" value={f.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex.: Aluguel do galpão, Energia, Contador" />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">FAVORECIDO</label>
              <input className="form-input" value={f.contraparte} onChange={e => set('contraparte', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CATEGORIA</label>
              <select className="form-select" value={f.categoria} onChange={e => set('categoria', e.target.value)}>
                {Object.entries(CATEGORIAS_PAGAR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">VALOR MENSAL (R$)</label>
              <input className="form-input" type="number" step="0.01" value={f.valor} onChange={e => set('valor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">DIA DO VENCIMENTO</label>
              <input className="form-input" type="number" min={1} max={31} value={f.dia_vencimento} onChange={e => set('dia_vencimento', e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            {!inicial && (
              <div className="form-group">
                <label className="form-label">A PARTIR DE</label>
                <input className="form-input" type="date" value={f.inicio} onChange={e => set('inicio', e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">ATÉ (OPCIONAL)</label>
              <input className="form-input" type="date" value={f.fim} onChange={e => set('fim', e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Os lançamentos entram sozinhos em Contas a Pagar, até 3 meses à frente. Se o dia não existir no mês (ex.: 31 em fevereiro), vence no último dia.
            {inicial && ' Alterar aqui atualiza os meses futuros ainda não pagos.'}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function AbaDespesasFixas({ recarregar }: { recarregar: () => void }) {
  const { toast } = useApp()
  const [lista, setLista] = useState<Recorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ inicial: Recorrencia | null } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await api('/api/financeiro/recorrencias')
    if (res.ok) setLista(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function alternar(r: Recorrencia) {
    const res = await api(`/api/financeiro/recorrencias/${r.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !r.ativo }) })
    if (res.ok) { carregar(); recarregar(); toast(r.ativo ? 'Despesa pausada' : 'Despesa reativada', 'ok2') }
  }
  async function excluir(r: Recorrencia) {
    if (!confirm(`Excluir "${r.descricao}"? Os meses futuros em aberto saem da previsão; os já pagos ficam no histórico.`)) return
    const res = await api(`/api/financeiro/recorrencias/${r.id}`, { method: 'DELETE' })
    if (res.ok) { carregar(); recarregar(); toast('Despesa excluída', 'ok2') }
  }

  const totalMensal = lista.filter(r => r.ativo).reduce((s, r) => s + Number(r.valor), 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Despesas fixas — {fmt(totalMensal)}/mês</span>
        <button className="btn btn-gold" onClick={() => setModal({ inicial: null })}>+ Nova despesa fixa</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Descrição</th><th>Favorecido</th><th>Categoria</th><th>Vence todo dia</th><th className="text-right">Valor</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="empty-state"><p>Carregando…</p></div></td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><h3>Nenhuma despesa fixa</h3><p>Cadastre aluguel, energia, internet, contador… uma vez só, e elas entram todo mês em Contas a Pagar.</p></div></td></tr>
            ) : lista.map(r => (
              <tr key={r.id} style={{ opacity: r.ativo ? 1 : 0.55 }}>
                <td style={{ fontWeight: 500 }}>{r.descricao}</td>
                <td className="text-sm">{r.contraparte || '—'}</td>
                <td className="text-sm">{CATEGORIAS_PAGAR[r.categoria] || r.categoria}</td>
                <td className="text-sm">{r.dia_vencimento}{r.fim ? ` (até ${fmtDate(r.fim)})` : ''}</td>
                <td className="text-right font-bold">{fmt(r.valor)}</td>
                <td>{r.ativo ? <span className="badge badge-ok">Ativa</span> : <span className="badge badge-draft">Pausada</span>}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setModal({ inicial: r })}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => alternar(r)}>{r.ativo ? '⏸ Pausar' : '▶ Reativar'}</button>
                    <button className="btn btn-ghost btn-sm" title="Excluir" onClick={() => excluir(r)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <RecorrenciaModal inicial={modal.inicial} onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(); recarregar(); toast('Despesa fixa salva', 'ok2') }} />
      )}
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

type Aba = 'receber' | 'pagar' | 'compras' | 'fixas'

export default function FinanceiroPage() {
  const { toast } = useApp()
  const [aba, setAba] = useState<Aba>('receber')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('aba')
    if (a === 'receber' || a === 'pagar' || a === 'compras' || a === 'fixas') setAba(a)
  }, [])

  const carregar = useCallback(async () => {
    const res = await api('/api/financeiro/lancamentos')
    if (res.ok) setLancamentos(await res.json())
    else { const d = await res.json().catch(() => ({})); toast(d.error || 'Erro ao carregar o financeiro', 'err') }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function trocarAba(a: Aba) {
    setAba(a)
    try { window.history.replaceState(null, '', `?aba=${a}`) } catch { /* ok */ }
  }

  // Resumo: tudo em aberto que vence até o fim do período (inclui vencidos) e o realizado no período.
  const [de, ate] = intervalo(periodo)
  const hoje = hojeISO()
  const resumo = useMemo(() => {
    const r = { entra: 0, sai: 0, recebido: 0, pago: 0, vencReceber: 0, vencPagar: 0 }
    for (const l of lancamentos) {
      const v = Number(l.valor)
      if (l.status === 'previsto' && l.vencimento <= ate) {
        if (l.tipo === 'receber') r.entra += v; else r.sai += v
        if (l.vencimento < hoje) { if (l.tipo === 'receber') r.vencReceber += v; else r.vencPagar += v }
      }
      if (l.status === 'pago' && l.data_pagamento && l.data_pagamento >= de && l.data_pagamento <= ate) {
        if (l.tipo === 'receber') r.recebido += v; else r.pago += v
      }
    }
    return r
  }, [lancamentos, de, ate, hoje])
  const saldo = resumo.entra - resumo.sai

  const abas: { id: Aba; label: string }[] = [
    { id: 'receber', label: '📥 Contas a Receber' },
    { id: 'pagar', label: '📤 Contas a Pagar' },
    { id: 'compras', label: '🛒 Compras Futuras' },
    { id: 'fixas', label: '🔁 Despesas Fixas' },
  ]

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Financeiro</h1>
        <select className="form-select" style={{ width: 'auto' }} value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}>
          {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Previsão de entrada</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(resumo.entra)}</div>
          {resumo.vencReceber > 0 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{fmt(resumo.vencReceber)} vencido</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Previsão de saída</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt(resumo.sai)}</div>
          {resumo.vencPagar > 0 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{fmt(resumo.vencPagar)} vencido</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Saldo previsto</div>
          <div className="stat-value" style={{ color: saldo < 0 ? 'var(--red)' : undefined }}>{fmt(saldo)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>em aberto até {periodo === 'tudo' ? 'o fim' : fmtDate(ate)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Realizado no período</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            <span style={{ color: 'var(--green)' }}>+{fmt(resumo.recebido)}</span><br />
            <span style={{ color: 'var(--red)' }}>−{fmt(resumo.pago)}</span>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {abas.map(a => (
          <button key={a.id} className={`tab${aba === a.id ? ' active' : ''}`} onClick={() => trocarAba(a.id)}>{a.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Carregando…</p></div>
      ) : (
        <>
          {aba === 'receber' && <AbaLancamentos tipo="receber" lancamentos={lancamentos} periodo={periodo} recarregar={carregar} />}
          {aba === 'pagar' && <AbaLancamentos tipo="pagar" lancamentos={lancamentos} periodo={periodo} recarregar={carregar} />}
          {aba === 'compras' && <AbaComprasFuturas lancamentos={lancamentos} recarregar={carregar} />}
          {aba === 'fixas' && <AbaDespesasFixas recarregar={carregar} />}
        </>
      )}
    </div>
  )
}

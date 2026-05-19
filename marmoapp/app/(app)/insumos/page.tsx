'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Insumo {
  id: string
  nome: string
  unidade: string
  categoria: string | null
  estoque_atual: number
  estoque_minimo: number
  preco_unitario: number | null
  alerta_estoque: boolean
}

interface Pedido {
  id: string
  numero_pedido: string | null
  status: 'pendente' | 'recebido' | 'cancelado'
  data_pedido: string
  data_recebimento: string | null
  observacoes: string | null
  fornecedoras: { nome: string } | null
  insumo_pedido_itens: { id: string; quantidade: number; preco_unitario: number | null; insumos: { nome: string; unidade: string } }[]
}

interface Retirada {
  id: string
  insumo_id: string
  funcionario_nome: string
  quantidade: number
  data_retirada: string
  observacao: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function apiFetch(url: string, init?: RequestInit) {
  return fetch(url, { credentials: 'include', ...init })
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'badge-pending' },
    recebido: { label: 'Recebido', cls: 'badge-approved' },
    cancelado: { label: 'Cancelado', cls: 'badge-rejected' },
  }
  const s = map[status] || { label: status, cls: '' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ─── Modal: Novo Insumo ───────────────────────────────────────────────────────

function ModalNovoInsumo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nome: '', categoria: '', unidade: 'un', estoque_minimo: '', preco_unitario: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    setLoading(true)
    const res = await apiFetch('/api/insumos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        categoria: form.categoria || null,
        unidade: form.unidade,
        estoque_minimo: parseFloat(form.estoque_minimo) || 0,
        preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error || 'Erro ao salvar'); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Novo Insumo</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">NOME *</label>
              <input className="form-input" placeholder="Ex: Disco de corte" value={form.nome} onChange={e => up('nome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CATEGORIA</label>
              <input className="form-input" placeholder="Ex: Ferramentas, EPI" value={form.categoria} onChange={e => up('categoria', e.target.value)} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">UNIDADE</label>
              <select className="form-select" value={form.unidade} onChange={e => up('unidade', e.target.value)}>
                <option value="un">unidade</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="m">m</option>
                <option value="cx">caixa</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ESTOQUE MÍNIMO</label>
              <input className="form-input" type="number" step="0.01" placeholder="0" value={form.estoque_minimo} onChange={e => up('estoque_minimo', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">PREÇO UNITÁRIO (R$)</label>
            <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.preco_unitario} onChange={e => up('preco_unitario', e.target.value)} />
          </div>
          {erro && <div style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : '💾 Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Retirada ──────────────────────────────────────────────────────────

function ModalRetirada({ insumo, onClose, onSaved }: { insumo: Insumo; onClose: () => void; onSaved: (novoEstoque: number, alerta: boolean) => void }) {
  const hoje = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ funcionario_nome: '', quantidade: '', data_retirada: hoje, observacao: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.funcionario_nome.trim()) { setErro('Funcionário obrigatório'); return }
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) { setErro('Quantidade inválida'); return }
    setLoading(true)
    const res = await apiFetch(`/api/insumos/${insumo.id}/retiradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_nome: form.funcionario_nome,
        quantidade: parseFloat(form.quantidade),
        data_retirada: form.data_retirada,
        observacao: form.observacao || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error || 'Erro ao registrar'); setLoading(false); return }
    onSaved(data.estoque_atual, data.alerta_estoque)
    onClose()
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Registrar Retirada — {insumo.nome}</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">FUNCIONÁRIO *</label>
              <input className="form-input" placeholder="Nome do funcionário" value={form.funcionario_nome} onChange={e => up('funcionario_nome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">QUANTIDADE *</label>
              <input className="form-input" type="number" step="0.01" placeholder="0" value={form.quantidade} onChange={e => up('quantidade', e.target.value)} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">DATA</label>
              <input className="form-input" type="date" value={form.data_retirada} onChange={e => up('data_retirada', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">OBSERVAÇÃO</label>
              <input className="form-input" placeholder="Opcional" value={form.observacao} onChange={e => up('observacao', e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray)' }}>
            Estoque atual: <strong>{insumo.estoque_atual} {insumo.unidade}</strong>
          </div>
          {erro && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={loading}>{loading ? 'Registrando...' : '✅ Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Novo Pedido ───────────────────────────────────────────────────────

function ModalNovoPedido({ insumos, onClose, onSaved }: { insumos: Insumo[]; onClose: () => void; onSaved: () => void }) {
  const hoje = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ fornecedora_nome: '', numero_pedido: '', data_pedido: hoje, observacoes: '' })
  const [itens, setItens] = useState([{ insumo_id: '', quantidade: '', preco_unitario: '' }])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function upForm(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function upItem(i: number, k: string, v: string) {
    setItens(its => its.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  }
  function addItem() { setItens(its => [...its, { insumo_id: '', quantidade: '', preco_unitario: '' }]) }
  function removeItem(i: number) { setItens(its => its.filter((_, idx) => idx !== i)) }

  async function salvar() {
    const itensValidos = itens.filter(it => it.insumo_id && parseFloat(it.quantidade) > 0)
    if (!itensValidos.length) { setErro('Adicione pelo menos um item válido'); return }
    setLoading(true)
    const res = await apiFetch('/api/insumos/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_pedido: form.numero_pedido || null,
        data_pedido: form.data_pedido,
        observacoes: form.observacoes || null,
        itens: itensValidos.map(it => ({
          insumo_id: it.insumo_id,
          quantidade: parseFloat(it.quantidade),
          preco_unitario: it.preco_unitario ? parseFloat(it.preco_unitario) : null,
        })),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error || 'Erro ao criar pedido'); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-title">Novo Pedido de Compra</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">FORNECEDORA</label>
              <input className="form-input" placeholder="Nome da fornecedora" value={form.fornecedora_nome} onChange={e => upForm('fornecedora_nome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nº DO PEDIDO</label>
              <input className="form-input" placeholder="Ex: PED-001" value={form.numero_pedido} onChange={e => upForm('numero_pedido', e.target.value)} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">DATA DO PEDIDO</label>
              <input className="form-input" type="date" value={form.data_pedido} onChange={e => upForm('data_pedido', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">OBSERVAÇÕES</label>
              <input className="form-input" placeholder="Opcional" value={form.observacoes} onChange={e => upForm('observacoes', e.target.value)} />
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, marginTop: 12 }}>ITENS DO PEDIDO</div>
          {itens.map((it, i) => (
            <div key={i} className="form-row" style={{ alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <select className="form-select" value={it.insumo_id} onChange={e => upItem(i, 'insumo_id', e.target.value)}>
                  <option value="">Selecione o insumo</option>
                  {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input className="form-input" type="number" step="0.01" placeholder="Qtd" value={it.quantidade} onChange={e => upItem(i, 'quantidade', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input className="form-input" type="number" step="0.01" placeholder="Preço/un" value={it.preco_unitario} onChange={e => upItem(i, 'preco_unitario', e.target.value)} />
              </div>
              {itens.length > 1 && (
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(i)} style={{ marginBottom: 0 }}>🗑️</button>
              )}
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: 4 }}>+ Adicionar item</button>

          {erro && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={loading}>{loading ? 'Criando...' : '💾 Criar Pedido'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Estoque ──────────────────────────────────────────────────────────────

function AbaEstoque() {
  const { toast } = useApp()
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [retiradaTarget, setRetiradaTarget] = useState<Insumo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/insumos')
    if (res.ok) setInsumos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = insumos.filter(i => !query || i.nome.toLowerCase().includes(query.toLowerCase()) || (i.categoria || '').toLowerCase().includes(query.toLowerCase()))
  const alertas = insumos.filter(i => i.alerta_estoque).length
  const valorTotal = insumos.reduce((acc, i) => acc + (i.estoque_atual * (i.preco_unitario || 0)), 0)

  async function excluir(id: string) {
    if (!confirm('Excluir este insumo?')) return
    const res = await apiFetch(`/api/insumos/${id}`, { method: 'DELETE' })
    if (res.ok) { toast('Insumo excluído', 'ok2'); load() }
    else toast('Erro ao excluir', 'err')
  }

  return (
    <div>
      {/* Cards de resumo */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total de insumos</div>
          <div className="stat-value">{insumos.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Estoque baixo</div>
          <div className="stat-value" style={{ color: alertas > 0 ? 'var(--red)' : undefined }}>
            {alertas}
            {alertas > 0 && <span className="badge badge-rejected" style={{ marginLeft: 8, fontSize: 11 }}>⚠️</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valor em estoque</div>
          <div className="stat-value">{fmt(valorTotal)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Insumos</span>
          <div className="flex gap-2">
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="form-input" style={{ width: 200, paddingLeft: 32 }} placeholder="Buscar..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <button className="btn btn-gold" onClick={() => setModalNovo(true)}>+ Novo insumo</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Categoria</th><th>Estoque</th><th>Un</th><th>Mínimo</th><th>Preço/Un</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="empty-state"><p>Carregando...</p></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><h3>Nenhum insumo cadastrado</h3></div></td></tr>
              ) : filtered.map(i => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 500 }}>{i.nome}</td>
                  <td className="text-gray text-sm">{i.categoria || '—'}</td>
                  <td className="text-sm" style={{ fontWeight: 600, color: i.alerta_estoque ? 'var(--red)' : undefined }}>{i.estoque_atual}</td>
                  <td className="text-sm">{i.unidade}</td>
                  <td className="text-sm">{i.estoque_minimo}</td>
                  <td className="font-bold">{i.preco_unitario ? fmt(i.preco_unitario) : '—'}</td>
                  <td>
                    {i.alerta_estoque
                      ? <span className="badge badge-rejected">⚠️ Estoque baixo</span>
                      : <span className="badge badge-approved">✅ OK</span>
                    }
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => setRetiradaTarget(i)} title="Registrar retirada">
                        📤 Retirar
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => excluir(i.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalNovo && (
        <ModalNovoInsumo
          onClose={() => setModalNovo(false)}
          onSaved={() => { load(); toast('Insumo criado', 'ok2') }}
        />
      )}

      {retiradaTarget && (
        <ModalRetirada
          insumo={retiradaTarget}
          onClose={() => setRetiradaTarget(null)}
          onSaved={(novoEstoque, alerta) => {
            setInsumos(ins => ins.map(i => i.id === retiradaTarget.id
              ? { ...i, estoque_atual: novoEstoque, alerta_estoque: alerta }
              : i
            ))
            toast('Retirada registrada', 'ok2')
          }}
        />
      )}
    </div>
  )
}

// ─── Aba Pedidos ──────────────────────────────────────────────────────────────

function AbaPedidos() {
  const { toast } = useApp()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [rPed, rIns] = await Promise.all([
      apiFetch('/api/insumos/pedidos'),
      apiFetch('/api/insumos'),
    ])
    if (rPed.ok) setPedidos(await rPed.json())
    if (rIns.ok) setInsumos(await rIns.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function receber(id: string) {
    if (!confirm('Marcar este pedido como recebido? O estoque será atualizado automaticamente.')) return
    const res = await apiFetch(`/api/insumos/pedidos/${id}/receber`, { method: 'POST' })
    if (res.ok) { toast('Pedido recebido — estoque atualizado', 'ok2'); load() }
    else {
      const d = await res.json()
      toast(d.error || 'Erro ao receber pedido', 'err')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pedidos de Compra</span>
          <button className="btn btn-gold" onClick={() => setModalNovo(true)}>+ Novo pedido</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nº Pedido</th><th>Fornecedora</th><th>Status</th><th>Data pedido</th><th>Data recebimento</th><th>Itens</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="empty-state"><p>Carregando...</p></div></td></tr>
              ) : pedidos.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><h3>Nenhum pedido</h3></div></td></tr>
              ) : pedidos.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.numero_pedido || '—'}</td>
                  <td className="text-sm">{p.fornecedoras?.nome || '—'}</td>
                  <td>{statusBadge(p.status)}</td>
                  <td className="text-sm">{fmtDate(p.data_pedido)}</td>
                  <td className="text-sm">{fmtDate(p.data_recebimento)}</td>
                  <td className="text-sm">{(p.insumo_pedido_itens || []).length} iten(s)</td>
                  <td>
                    {p.status === 'pendente' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => receber(p.id)}>
                        ✅ Receber
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalNovo && (
        <ModalNovoPedido
          insumos={insumos}
          onClose={() => setModalNovo(false)}
          onSaved={() => { load(); toast('Pedido criado', 'ok2') }}
        />
      )}
    </div>
  )
}

// ─── Aba Retiradas ────────────────────────────────────────────────────────────

function AbaRetiradas() {
  const [retiradas, setRetiradas] = useState<(Retirada & { insumo_nome: string; insumo_unidade: string })[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFunc, setFiltroFunc] = useState('')

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [filtroMes, setFiltroMes] = useState(mesAtual)

  const load = useCallback(async () => {
    setLoading(true)
    const [rIns] = await Promise.all([apiFetch('/api/insumos')])
    const insData: Insumo[] = rIns.ok ? await rIns.json() : []
    setInsumos(insData)

    // Busca retiradas de todos os insumos
    const allRetiradas: (Retirada & { insumo_nome: string; insumo_unidade: string })[] = []
    await Promise.all(insData.map(async ins => {
      const r = await apiFetch(`/api/insumos/${ins.id}/retiradas`)
      if (r.ok) {
        const list: Retirada[] = await r.json()
        list.forEach(ret => allRetiradas.push({ ...ret, insumo_nome: ins.nome, insumo_unidade: ins.unidade }))
      }
    }))
    allRetiradas.sort((a, b) => b.data_retirada.localeCompare(a.data_retirada))
    setRetiradas(allRetiradas)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = retiradas.filter(r => {
    const mesMatch = !filtroMes || r.data_retirada.startsWith(filtroMes)
    const funcMatch = !filtroFunc || r.funcionario_nome.toLowerCase().includes(filtroFunc.toLowerCase())
    return mesMatch && funcMatch
  })

  const totalQtd = filtered.reduce((acc, r) => acc + Number(r.quantidade), 0)
  const funcionarios = [...new Set(retiradas.map(r => r.funcionario_nome))].sort()

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title">Retiradas ({filtered.length})</span>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <input className="form-input" type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ width: 160 }} />
            <select className="form-select" value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)} style={{ width: 180 }}>
              <option value="">Todos os funcionários</option>
              {funcionarios.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {!loading && (
          <div style={{ padding: '8px 20px', fontSize: 13, color: 'var(--gray)', borderBottom: '1px solid var(--border)' }}>
            Total de retiradas no período: <strong>{totalQtd.toFixed(2)}</strong> unidades
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Funcionário</th><th>Insumo</th><th>Quantidade</th><th>Observação</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}><div className="empty-state"><p>Carregando...</p></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><h3>Nenhuma retirada no período</h3></div></td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td className="text-sm">{fmtDate(r.data_retirada)}</td>
                  <td style={{ fontWeight: 500 }}>{r.funcionario_nome}</td>
                  <td className="text-sm">{r.insumo_nome}</td>
                  <td className="text-sm">{r.quantidade} {r.insumo_unidade}</td>
                  <td className="text-gray text-sm">{r.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function InsumosPage() {
  const [aba, setAba] = useState<'estoque' | 'pedidos' | 'retiradas'>('estoque')

  const abas = [
    { id: 'estoque', label: '📦 Estoque' },
    { id: 'pedidos', label: '🛒 Pedidos' },
    { id: 'retiradas', label: '📤 Retiradas' },
  ] as const

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Insumos</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {abas.map(a => (
          <button
            key={a.id}
            className={`tab${aba === a.id ? ' active' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'estoque' && <AbaEstoque />}
      {aba === 'pedidos' && <AbaPedidos />}
      {aba === 'retiradas' && <AbaRetiradas />}
    </div>
  )
}

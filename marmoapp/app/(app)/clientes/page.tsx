'use client'

import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal, formatPhone, fetchCEP } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/types'

const ORIGENS = ['indicação', 'google', 'instagram', 'presencial', 'whatsapp', 'outros']

function ClienteModal({
  cliente, marmorariaId, onClose, onSaved,
}: {
  cliente: Cliente | null
  marmorariaId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    tipo: cliente?.tipo || 'pf',
    cpf_cnpj: cliente?.cpf_cnpj || '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    origem: cliente?.origem || 'indicação',
    obs: cliente?.observacoes || '',
    cep: cliente?.cep || '',
    estado: cliente?.estado || '',
    cidade: cliente?.cidade || '',
    endereco: cliente?.endereco || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCEP() {
    const data = await fetchCEP(form.cep)
    if (data) setForm(f => ({ ...f, cidade: data.localidade || f.cidade, estado: data.uf || f.estado, endereco: data.logradouro || f.endereco }))
  }

  async function save() {
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return }
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: usuarioData, error: userError } = await supabase
        .from('usuarios')
        .select('marmoraria_id')
        .eq('id', user.id)
        .single()

      if (userError || !usuarioData?.marmoraria_id) {
        throw new Error('Marmoraria não encontrada')
      }

      const payload = {
        nome: form.nome,
        tipo: form.tipo,
        cpf_cnpj: form.cpf_cnpj || null,
        telefone: form.telefone || null,
        email: form.email || null,
        origem: form.origem || null,
        cep: form.cep || null,
        estado: form.estado || null,
        cidade: form.cidade || null,
        endereco: form.endereco || null,
        observacoes: form.obs || null,
        marmoraria_id: usuarioData.marmoraria_id,
      }

      const { error: err } = cliente
        ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
        : await supabase.from('clientes').insert(payload)

      if (err) throw err

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err)
      setError(err?.message || err?.details || 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{cliente ? 'Editar Cliente' : 'Novo Cliente'}</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">NOME / RAZÃO SOCIAL *</label>
              <input className="form-input" placeholder="Nome completo" value={form.nome} onChange={e => up('nome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">TIPO</label>
              <select className="form-select" value={form.tipo} onChange={e => up('tipo', e.target.value)}>
                <option value="pf">Pessoa Física</option>
                <option value="pj">Pessoa Jurídica</option>
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">CPF / CNPJ</label>
              <input className="form-input" placeholder="000.000.000-00" value={form.cpf_cnpj} onChange={e => up('cpf_cnpj', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">TELEFONE / WHATSAPP</label>
              <input className="form-input" placeholder="(11) 99999-0000" maxLength={15} value={form.telefone} onChange={e => up('telefone', formatPhone(e.target.value))} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">E-MAIL</label>
              <input className="form-input" type="email" placeholder="email@cliente.com" value={form.email} onChange={e => up('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ORIGEM</label>
              <select className="form-select" value={form.origem} onChange={e => up('origem', e.target.value)}>
                {ORIGENS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">CEP</label>
              <input className="form-input" placeholder="00000-000" maxLength={9} value={form.cep}
                onChange={e => up('cep', e.target.value)} onBlur={handleCEP} />
            </div>
            <div className="form-group">
              <label className="form-label">ESTADO</label>
              <input className="form-input" placeholder="SP" maxLength={2} value={form.estado} onChange={e => up('estado', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">ENDEREÇO</label>
            <input className="form-input" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => up('endereco', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">OBSERVAÇÕES</label>
            <input className="form-input" placeholder="Anotações..." value={form.obs} onChange={e => up('obs', e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={save} disabled={loading}>{loading ? 'Salvando...' : '💾 Salvar Cliente'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ClientesPage() {
  const { clientes, orcamentos, marmoraria, loadClientes, toast } = useApp()
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null })

  const filtered = clientes.filter(c =>
    !query || c.nome.toLowerCase().includes(query.toLowerCase()) || (c.telefone || '').includes(query)
  )

  function clienteOrcs(id: string) {
    return orcamentos.filter(o => (o.clienteId || o.cliente_id) === id && o.status === 'aprovado')
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    await loadClientes()
    toast('Cliente excluído', 'ok2')
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        <button className="btn btn-gold" onClick={() => setModal({ open: true, cliente: null })}>+ Novo Cliente</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Base de Clientes</span>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="form-input" style={{ width: 220, paddingLeft: 32 }} placeholder="Buscar cliente..."
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Tipo</th><th>Telefone</th><th>Origem</th>
                <th>Orçamentos</th><th>Total Gasto</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><h3>Nenhum cliente</h3><p>Cadastre seu primeiro cliente</p></div></td></tr>
              ) : filtered.map(c => {
                const orcs = clienteOrcs(c.id)
                const total = orcs.reduce((s, o) => s + orcTotal(o), 0)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td><span className={`badge ${c.tipo === 'pj' ? 'badge-sent' : 'badge-draft'}`}>{c.tipo === 'pj' ? 'PJ' : 'PF'}</span></td>
                    <td className="text-sm">{c.telefone || '—'}</td>
                    <td className="text-sm text-gray">{c.origem || '—'}</td>
                    <td className="text-sm">{orcs.length}</td>
                    <td className="font-bold">{total > 0 ? fmt(total) : '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ open: true, cliente: c })}>✏️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => excluir(c.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && marmoraria && (
        <ClienteModal
          cliente={modal.cliente}
          marmorariaId={marmoraria.id}
          onClose={() => setModal({ open: false, cliente: null })}
          onSaved={loadClientes}
        />
      )}
    </div>
  )
}

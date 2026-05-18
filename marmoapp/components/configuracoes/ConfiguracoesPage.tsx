'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import type { AgendaEventType } from '@/lib/agenda/types'
import type { ProjectCostType } from '@/lib/projetos/types'
import type { ProjectCustomStatus, ClientCustomField, FieldType } from '@/lib/configuracoes/types'

// ── Fixed project statuses (read-only) ───────────────────────
const FIXED_STATUSES = [
  { id: 'em_andamento', nome: 'Em andamento', cor: '#2980B9' },
  { id: 'concluido',    nome: 'Concluído',    cor: '#27AE60' },
  { id: 'cancelado',    nome: 'Cancelado',    cor: '#C0392B' },
]

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  texto:    'Texto',
  numero:   'Número',
  data:     'Data',
  booleano: 'Sim/Não',
}

// ── Auth helper ───────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function apiFetch(url: string, opts?: RequestInit): Promise<Response> {
  const token = await getToken()
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  })
}

// ── Color swatch ──────────────────────────────────────────────
function ColorDot({ cor }: { cor: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      background: cor, border: '1.5px solid rgba(0,0,0,0.1)', flexShrink: 0,
    }} />
  )
}

// ── Generic nome+cor modal ────────────────────────────────────
function NomeCorModal({
  title, initial, onSave, onClose,
}: {
  title: string
  initial: { nome: string; cor: string }
  onSave: (nome: string, cor: string) => Promise<void>
  onClose: () => void
}) {
  const [nome, setNome] = useState(initial.nome)
  const [cor, setCor] = useState(initial.cor)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!nome.trim()) { setErr('Nome é obrigatório'); return }
    setSaving(true)
    try {
      await onSave(nome.trim(), cor)
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">NOME *</label>
            <input
              className="form-input"
              placeholder="Digite o nome…"
              value={nome}
              onChange={e => { setNome(e.target.value); setErr('') }}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">COR</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={cor}
                onChange={e => setCor(e.target.value)}
                style={{ width: 44, height: 36, border: '1.5px solid #eee', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
              <span style={{ fontSize: 13, color: 'var(--gray)' }}>{cor}</span>
            </div>
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campo de cliente modal ────────────────────────────────────
function CampoModal({
  initial, onSave, onClose,
}: {
  initial: Partial<ClientCustomField>
  onSave: (v: { nome: string; tipo: FieldType; obrigatorio: boolean }) => Promise<void>
  onClose: () => void
}) {
  const [nome, setNome] = useState(initial.nome ?? '')
  const [tipo, setTipo] = useState<FieldType>(initial.tipo ?? 'texto')
  const [obrigatorio, setObrigatorio] = useState(initial.obrigatorio ?? false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!nome.trim()) { setErr('Nome é obrigatório'); return }
    setSaving(true)
    try {
      await onSave({ nome: nome.trim(), tipo, obrigatorio })
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">{initial.id ? 'Editar campo' : 'Novo campo'}</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">NOME DO CAMPO *</label>
            <input
              className="form-input"
              placeholder="Ex: Arquiteto responsável"
              value={nome}
              onChange={e => { setNome(e.target.value); setErr('') }}
              autoFocus
            />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">TIPO</label>
              <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as FieldType)}>
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="data">Data</option>
                <option value="booleano">Sim/Não</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">OBRIGATÓRIO</label>
              <div
                onClick={() => setObrigatorio(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, height: 42,
                  cursor: 'pointer', padding: '0 13px', border: '1.5px solid var(--marble2)',
                  borderRadius: 8, userSelect: 'none',
                  background: obrigatorio ? 'rgba(201,168,76,0.08)' : 'var(--white)',
                  borderColor: obrigatorio ? 'var(--gold)' : 'var(--marble2)',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 4, border: '1.5px solid',
                  borderColor: obrigatorio ? 'var(--gold)' : 'var(--gray2)',
                  background: obrigatorio ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {obrigatorio && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                <span style={{ fontSize: 13, color: obrigatorio ? 'var(--dark)' : 'var(--gray)' }}>
                  {obrigatorio ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Icon buttons ──────────────────────────────────────────────
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-ghost btn-icon"
      title="Editar"
      style={{ color: 'var(--gray)' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  )
}

function DeleteBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn btn-ghost btn-icon"
      title={disabled ? 'Vinculado a registros — não pode ser excluído' : 'Excluir'}
      style={{ color: disabled ? 'var(--gray2)' : 'var(--gray)', cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  )
}

// ── Section card shell ────────────────────────────────────────
function SectionCard({
  title, description, onAdd, addLabel = '+ Novo', children,
}: {
  title: string
  description?: string
  onAdd: () => void
  addLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {description && <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>{description}</div>}
        </div>
        <button className="btn btn-gold btn-sm" onClick={onAdd}>{addLabel}</button>
      </div>
      <div style={{ padding: 0 }}>{children}</div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--gray2)', fontSize: 13 }}>
      {label}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { toast } = useApp()

  // Section 1 — tipos de agendamento
  const [tipos, setTipos] = useState<AgendaEventType[]>([])
  const [tipoModal, setTipoModal] = useState<{ open: boolean; item: AgendaEventType | null }>({ open: false, item: null })

  // Section 2 — categorias de custo
  const [categorias, setCategorias] = useState<ProjectCostType[]>([])
  const [catModal, setCatModal] = useState<{ open: boolean; item: ProjectCostType | null }>({ open: false, item: null })

  // Section 3 — status de projetos
  const [statuses, setStatuses] = useState<ProjectCustomStatus[]>([])
  const [statusModal, setStatusModal] = useState<{ open: boolean; item: ProjectCustomStatus | null }>({ open: false, item: null })

  // Section 4 — campos de clientes
  const [campos, setCampos] = useState<ClientCustomField[]>([])
  const [campoModal, setCampoModal] = useState<{ open: boolean; item: ClientCustomField | null }>({ open: false, item: null })

  const [loading, setLoading] = useState(true)

  // ── Load all data ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, c, s, f] = await Promise.all([
        apiFetch('/api/configuracoes/tipos-agendamento').then(r => r.json()),
        apiFetch('/api/configuracoes/categorias-custo').then(r => r.json()),
        apiFetch('/api/configuracoes/status-projetos').then(r => r.json()),
        apiFetch('/api/configuracoes/campos-clientes').then(r => r.json()),
      ])
      setTipos(Array.isArray(t) ? t : [])
      setCategorias(Array.isArray(c) ? c : [])
      setStatuses(Array.isArray(s) ? s : [])
      setCampos(Array.isArray(f) ? f : [])
    } catch {
      toast('Erro ao carregar configurações', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Generic error extractor ──────────────────────────────────
  async function extractError(res: Response): Promise<string> {
    try {
      const j = await res.json()
      return j.error ?? 'Erro desconhecido'
    } catch {
      return `Erro ${res.status}`
    }
  }

  // ── Section 1 handlers ───────────────────────────────────────
  async function saveTipo(nome: string, cor: string) {
    const item = tipoModal.item
    const res = item
      ? await apiFetch(`/api/configuracoes/tipos-agendamento/${item.id}`, { method: 'PATCH', body: JSON.stringify({ nome, cor }) })
      : await apiFetch('/api/configuracoes/tipos-agendamento', { method: 'POST', body: JSON.stringify({ nome, cor }) })

    if (!res.ok) throw new Error(await extractError(res))
    await loadAll()
    toast(item ? 'Tipo atualizado' : 'Tipo criado', 'ok2')
  }

  async function deleteTipo(id: string) {
    const res = await apiFetch(`/api/configuracoes/tipos-agendamento/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(await extractError(res), 'err'); return }
    setTipos(prev => prev.filter(t => t.id !== id))
    toast('Tipo excluído', 'ok')
  }

  // ── Section 2 handlers ───────────────────────────────────────
  async function saveCategoria(nome: string, cor: string) {
    const item = catModal.item
    const res = item
      ? await apiFetch(`/api/configuracoes/categorias-custo/${item.id}`, { method: 'PATCH', body: JSON.stringify({ nome, cor }) })
      : await apiFetch('/api/configuracoes/categorias-custo', { method: 'POST', body: JSON.stringify({ nome, cor }) })

    if (!res.ok) throw new Error(await extractError(res))
    await loadAll()
    toast(item ? 'Categoria atualizada' : 'Categoria criada', 'ok2')
  }

  async function deleteCategoria(id: string) {
    const res = await apiFetch(`/api/configuracoes/categorias-custo/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(await extractError(res), 'err'); return }
    setCategorias(prev => prev.filter(c => c.id !== id))
    toast('Categoria excluída', 'ok')
  }

  // ── Section 3 handlers ───────────────────────────────────────
  async function saveStatus(nome: string, cor: string) {
    const item = statusModal.item
    const res = item
      ? await apiFetch(`/api/configuracoes/status-projetos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ nome, cor }) })
      : await apiFetch('/api/configuracoes/status-projetos', { method: 'POST', body: JSON.stringify({ nome, cor }) })

    if (!res.ok) throw new Error(await extractError(res))
    await loadAll()
    toast(item ? 'Status atualizado' : 'Status criado', 'ok2')
  }

  async function deleteStatus(id: string) {
    const res = await apiFetch(`/api/configuracoes/status-projetos/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(await extractError(res), 'err'); return }
    setStatuses(prev => prev.filter(s => s.id !== id))
    toast('Status excluído', 'ok')
  }

  // ── Section 4 handlers ───────────────────────────────────────
  async function saveCampo(v: { nome: string; tipo: FieldType; obrigatorio: boolean }) {
    const item = campoModal.item
    const res = item
      ? await apiFetch(`/api/configuracoes/campos-clientes/${item.id}`, { method: 'PATCH', body: JSON.stringify(v) })
      : await apiFetch('/api/configuracoes/campos-clientes', { method: 'POST', body: JSON.stringify(v) })

    if (!res.ok) throw new Error(await extractError(res))
    await loadAll()
    toast(item ? 'Campo atualizado' : 'Campo criado', 'ok2')
  }

  async function deleteCampo(id: string) {
    const res = await apiFetch(`/api/configuracoes/campos-clientes/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(await extractError(res), 'err'); return }
    setCampos(prev => prev.filter(c => c.id !== id))
    toast('Campo excluído', 'ok')
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1 className="page-title">Configurações</h1></div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray)' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
      </div>

      {/* ── SEÇÃO 1: Tipos de Agendamento ── */}
      <SectionCard
        title="Tipos de Agendamento"
        description="Categorize seus eventos na agenda com cores personalizadas."
        onAdd={() => setTipoModal({ open: true, item: null })}
        addLabel="+ Novo tipo"
      >
        {tipos.length === 0 ? (
          <EmptyRow label="Nenhum tipo cadastrado. Clique em '+ Novo tipo' para começar." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Nome</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map(t => (
                  <tr key={t.id}>
                    <td><ColorDot cor={t.cor} /></td>
                    <td style={{ fontWeight: 500 }}>{t.nome}</td>
                    <td style={{ textAlign: 'right' }}>
                      <EditBtn onClick={() => setTipoModal({ open: true, item: t })} />
                      <DeleteBtn onClick={() => deleteTipo(t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── SEÇÃO 2: Categorias de Custo ── */}
      <SectionCard
        title="Categorias de Custo"
        description="Organize os lançamentos de custo dos projetos por categoria."
        onAdd={() => setCatModal({ open: true, item: null })}
        addLabel="+ Nova categoria"
      >
        {categorias.length === 0 ? (
          <EmptyRow label="Nenhuma categoria cadastrada. Clique em '+ Nova categoria' para começar." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Nome</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(c => (
                  <tr key={c.id}>
                    <td><ColorDot cor={c.cor} /></td>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td style={{ textAlign: 'right' }}>
                      <EditBtn onClick={() => setCatModal({ open: true, item: c })} />
                      <DeleteBtn onClick={() => deleteCategoria(c.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── SEÇÃO 3: Status de Projetos ── */}
      <SectionCard
        title="Status de Projetos"
        description="Os status fixos (abaixo) não podem ser excluídos. Adicione status personalizados."
        onAdd={() => setStatusModal({ open: true, item: null })}
        addLabel="+ Novo status"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Nome</th>
                <th style={{ width: 80 }}>Tipo</th>
                <th style={{ width: 100, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {FIXED_STATUSES.map(s => (
                <tr key={s.id}>
                  <td><ColorDot cor={s.cor} /></td>
                  <td style={{ fontWeight: 500 }}>{s.nome}</td>
                  <td>
                    <span className="badge badge-draft" style={{ fontSize: 11 }}>Fixo</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <EditBtn onClick={() => {}} />
                    <DeleteBtn onClick={() => {}} disabled />
                  </td>
                </tr>
              ))}
              {statuses.map(s => (
                <tr key={s.id}>
                  <td><ColorDot cor={s.cor} /></td>
                  <td style={{ fontWeight: 500 }}>{s.nome}</td>
                  <td>
                    <span className="badge badge-approved" style={{ fontSize: 11 }}>Personalizado</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <EditBtn onClick={() => setStatusModal({ open: true, item: s })} />
                    <DeleteBtn onClick={() => deleteStatus(s.id)} />
                  </td>
                </tr>
              ))}
              {statuses.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray2)', fontSize: 13, padding: '20px 0' }}>
                    Nenhum status personalizado. Clique em &apos;+ Novo status&apos; para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── SEÇÃO 4: Campos extras de clientes ── */}
      <SectionCard
        title="Campos Extras de Clientes"
        description="Adicione campos personalizados ao formulário de cadastro de clientes."
        onAdd={() => setCampoModal({ open: true, item: null })}
        addLabel="+ Novo campo"
      >
        {campos.length === 0 ? (
          <EmptyRow label="Nenhum campo extra cadastrado. Clique em '+ Novo campo' para começar." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 110 }}>Obrigatório</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campos.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td>
                      <span className="badge badge-sent" style={{ fontSize: 11 }}>
                        {FIELD_TYPE_LABELS[c.tipo]}
                      </span>
                    </td>
                    <td>
                      {c.obrigatorio
                        ? <span className="badge badge-approved" style={{ fontSize: 11 }}>Sim</span>
                        : <span className="badge badge-draft" style={{ fontSize: 11 }}>Não</span>
                      }
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <EditBtn onClick={() => setCampoModal({ open: true, item: c })} />
                      <DeleteBtn onClick={() => deleteCampo(c.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Modals ── */}
      {tipoModal.open && (
        <NomeCorModal
          title={tipoModal.item ? 'Editar tipo de agendamento' : 'Novo tipo de agendamento'}
          initial={{ nome: tipoModal.item?.nome ?? '', cor: tipoModal.item?.cor ?? '#C9A84C' }}
          onSave={saveTipo}
          onClose={() => setTipoModal({ open: false, item: null })}
        />
      )}

      {catModal.open && (
        <NomeCorModal
          title={catModal.item ? 'Editar categoria de custo' : 'Nova categoria de custo'}
          initial={{ nome: catModal.item?.nome ?? '', cor: catModal.item?.cor ?? '#2980B9' }}
          onSave={saveCategoria}
          onClose={() => setCatModal({ open: false, item: null })}
        />
      )}

      {statusModal.open && (
        <NomeCorModal
          title={statusModal.item ? 'Editar status' : 'Novo status de projeto'}
          initial={{ nome: statusModal.item?.nome ?? '', cor: statusModal.item?.cor ?? '#888888' }}
          onSave={saveStatus}
          onClose={() => setStatusModal({ open: false, item: null })}
        />
      )}

      {campoModal.open && (
        <CampoModal
          initial={campoModal.item ?? {}}
          onSave={saveCampo}
          onClose={() => setCampoModal({ open: false, item: null })}
        />
      )}
    </div>
  )
}

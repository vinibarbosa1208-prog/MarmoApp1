'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import type { AgendaEventType, CreateAgendaEventInput } from '@/lib/agenda/types'

interface Funcionario { id: string; nome: string; cargo: string; ativo: boolean }

interface Props {
  tipos: AgendaEventType[]
  onClose: () => void
  onSaved: () => void
  defaultData?: string // ISO date string for the day clicked
}

export default function NovoEventoModal({ tipos, onClose, onSaved, defaultData }: Props) {
  const { clientes, orcamentos, marmoraria, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [form, setForm] = useState<CreateAgendaEventInput>({
    titulo: '',
    tipo_id: tipos[0]?.id ?? '',
    data_inicio: defaultData ? `${defaultData}T09:00` : '',
    data_fim: '',
    dia_inteiro: false,
    cliente_id: '',
    orcamento_id: '',
    responsavel_id: '',
    descricao: '',
  })

  const set = (k: keyof CreateAgendaEventInput, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/funcionarios', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Funcionario[]) => setFuncionarios(data.filter(f => f.ativo)))
  }, [])

  // Filter orcamentos by selected cliente
  const orcsDoCliente = form.cliente_id
    ? orcamentos.filter(o => (o.cliente_id || o.clienteId) === form.cliente_id)
    : orcamentos

  async function salvar() {
    if (!form.titulo.trim()) { toast('Título obrigatório', 'err'); return }
    if (!form.data_inicio) { toast('Data de início obrigatória', 'err'); return }
    setSaving(true)
    try {
      if (!marmoraria?.id) throw new Error('Sessão inválida — recarregue a página')

      const payload: CreateAgendaEventInput & { marmoraria_id: string; status: string } = {
        titulo: form.titulo.trim(),
        tipo_id: form.tipo_id || undefined,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : undefined,
        dia_inteiro: form.dia_inteiro,
        cliente_id: form.cliente_id || undefined,
        orcamento_id: form.orcamento_id || undefined,
        descricao: form.descricao || undefined,
        marmoraria_id: marmoraria.id,
        status: 'agendado',
      }

      const { error } = await supabase.from('agenda_events').insert(payload)
      if (error) throw error
      toast('Evento criado', 'ok')
      onSaved()
      onClose()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 560, marginTop: 40 }}>
        <div className="modal-header">
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 }}>
            Novo Evento
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Título *</label>
            <input className="form-control" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Instalação bancada João Silva" />
          </div>

          <div className="form-row form-row-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo</label>
              <select className="form-control" value={form.tipo_id} onChange={e => set('tipo_id', e.target.value)}>
                <option value="">— Tipo —</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Dia inteiro
                <input type="checkbox" checked={form.dia_inteiro} onChange={e => set('dia_inteiro', e.target.checked)} style={{ width: 'auto' }} />
              </label>
              <div style={{ height: 40 }} />
            </div>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data início *</label>
              <input className="form-control" type={form.dia_inteiro ? 'date' : 'datetime-local'}
                value={form.dia_inteiro ? form.data_inicio?.split('T')[0] : form.data_inicio}
                onChange={e => set('data_inicio', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data fim</label>
              <input className="form-control" type={form.dia_inteiro ? 'date' : 'datetime-local'}
                value={form.dia_inteiro ? form.data_fim?.split('T')[0] : form.data_fim}
                onChange={e => set('data_fim', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Cliente</label>
            <select className="form-control" value={form.cliente_id}
              onChange={e => { set('cliente_id', e.target.value); set('orcamento_id', '') }}>
              <option value="">— Selecionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Orçamento</label>
            <select className="form-control" value={form.orcamento_id} onChange={e => set('orcamento_id', e.target.value)}>
              <option value="">— Selecionar orçamento —</option>
              {orcsDoCliente.map(o => (
                <option key={o.id} value={o.id}>
                  {o.descricao || `Orç. #${o.numero || o.id.slice(0, 6)}`} — {o.status}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Funcionário Responsável</label>
            <select className="form-control" value={form.responsavel_id ?? ''} onChange={e => set('responsavel_id', e.target.value)}>
              <option value="">— Nenhum —</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descrição</label>
            <textarea className="form-control" rows={2} value={form.descricao}
              onChange={e => set('descricao', e.target.value)} placeholder="Observações..." />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn-gold" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar evento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import type { AgendaEvent, AgendaEventType } from '@/lib/agenda/types'
import EventCard from './EventCard'
import NovoEventoModal from './NovoEventoModal'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function AgendaPage() {
  const { marmoraria } = useApp()
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()))
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [tipos, setTipos] = useState<AgendaEventType[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [defaultDay, setDefaultDay] = useState<string>('')
  const [filterTipo, setFilterTipo] = useState<string>('')
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null)

  // Uses marmoraria from AppContext — no getUser() network call needed
  const loadTipos = useCallback(async () => {
    if (!marmoraria?.id) return
    const { data } = await supabase.from('agenda_event_types').select('*').eq('marmoraria_id', marmoraria.id).order('nome')
    setTipos(data || [])
  }, [marmoraria?.id])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      if (tipos.length === 0) await loadTipos()
      const res = await fetch(`/api/agenda/events?semana=${isoDate(monday)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setEvents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [monday, tipos.length, loadTipos])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const semanaLabel = (() => {
    const fim = new Date(monday)
    fim.setDate(fim.getDate() + 6)
    return `${monday.getDate()} ${MESES[monday.getMonth()]} — ${fim.getDate()} ${MESES[fim.getMonth()]} ${fim.getFullYear()}`
  })()

  function navSemana(delta: number) {
    setMonday(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  function getDayEvents(dayOffset: number): AgendaEvent[] {
    const d = new Date(monday)
    d.setDate(d.getDate() + dayOffset)
    const dayStr = isoDate(d)
    return events
      .filter(e => {
        if (filterTipo && e.tipo_id !== filterTipo) return false
        return e.data_inicio.startsWith(dayStr)
      })
  }

  async function cancelarEvento(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/agenda/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    await loadEvents()
    setSelectedEvent(null)
  }

  async function concluirEvento(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/agenda/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status: 'concluido' }),
    })
    await loadEvents()
    setSelectedEvent(null)
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Agenda</h1>
        <button className="btn btn-gold" onClick={() => { setDefaultDay(isoDate(new Date())); setShowModal(true) }}>
          + Novo evento
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '6px 12px', boxShadow: 'var(--shadow)' }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navSemana(-1)}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: 'center' }}>{semanaLabel}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navSemana(1)}>›</button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setMonday(getMondayOf(new Date()))}>Hoje</button>
        <select className="form-control" style={{ width: 'auto', fontSize: 13, padding: '6px 12px' }}
          value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: 'var(--gray)' }}>Carregando...</span>}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {DIAS.map((dia, i) => {
          const d = new Date(monday)
          d.setDate(d.getDate() + i)
          const isToday = isoDate(d) === isoDate(new Date())
          const dayEvents = getDayEvents(i)
          return (
            <div key={i} style={{ background: 'var(--white)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow)', border: isToday ? '2px solid var(--gold)' : '1px solid var(--marble2)', minHeight: 180 }}>
              <div style={{
                padding: '8px 10px', background: isToday ? 'var(--gold)' : 'var(--marble)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--dark)' : 'var(--gray)' }}>{dia}</span>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: isToday ? 'var(--dark)' : 'var(--dark)',
                  width: 28, height: 28, borderRadius: '50%',
                  background: isToday ? 'rgba(0,0,0,0.15)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.getDate()}
                </span>
              </div>
              <div style={{ padding: '6px 6px', minHeight: 120 }}>
                {dayEvents.map(e => (
                  <EventCard key={e.id} event={e} onClick={setSelectedEvent} />
                ))}
                <button
                  onClick={() => { setDefaultDay(isoDate(d)); setShowModal(true) }}
                  style={{ width: '100%', background: 'none', border: '1px dashed var(--marble2)', borderRadius: 5, padding: '4px 0', color: 'var(--gray2)', fontSize: 16, cursor: 'pointer', marginTop: 2 }}
                >+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setSelectedEvent(null) }}>
          <div className="modal" style={{ maxWidth: 440, marginTop: 60 }}>
            <div className="modal-header">
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600 }}>
                {selectedEvent.titulo}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedEvent(null)}>✕</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedEvent.tipo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: selectedEvent.tipo.cor, display: 'inline-block' }} />
                  <span style={{ fontSize: 13 }}>{selectedEvent.tipo.nome}</span>
                </div>
              )}
              <div style={{ fontSize: 13 }}>
                <strong>Início:</strong> {new Date(selectedEvent.data_inicio).toLocaleString('pt-BR')}
              </div>
              {selectedEvent.data_fim && (
                <div style={{ fontSize: 13 }}>
                  <strong>Fim:</strong> {new Date(selectedEvent.data_fim).toLocaleString('pt-BR')}
                </div>
              )}
              {selectedEvent.cliente_nome && <div style={{ fontSize: 13 }}><strong>Cliente:</strong> {selectedEvent.cliente_nome}</div>}
              {selectedEvent.descricao && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{selectedEvent.descricao}</div>}
              {selectedEvent.status !== 'cancelado' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {selectedEvent.status === 'agendado' && (
                    <button className="btn btn-gold btn-sm" onClick={() => concluirEvento(selectedEvent.id)}>Concluir</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => cancelarEvento(selectedEvent.id)}>Cancelar evento</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <NovoEventoModal
          tipos={tipos}
          defaultData={defaultDay}
          onClose={() => setShowModal(false)}
          onSaved={loadEvents}
        />
      )}
    </div>
  )
}

'use client'

import type { AgendaEvent } from '@/lib/agenda/types'

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  agendado: 'var(--blue)', concluido: 'var(--green)', cancelado: 'var(--gray)',
}

interface Props {
  event: AgendaEvent
  onClick: (event: AgendaEvent) => void
}

export default function EventCard({ event, onClick }: Props) {
  const cor = event.tipo?.cor ?? '#C9A84C'
  const hora = event.dia_inteiro
    ? 'Dia inteiro'
    : new Date(event.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      onClick={() => onClick(event)}
      style={{
        borderLeft: `3px solid ${cor}`,
        background: '#fff',
        borderRadius: 6,
        padding: '7px 10px',
        marginBottom: 5,
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        opacity: event.status === 'cancelado' ? 0.5 : 1,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', marginBottom: 2, lineHeight: 1.3 }}>
        {event.titulo}
      </div>
      <div style={{ fontSize: 11, color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>{hora}</span>
        {event.cliente_nome && <span>· {event.cliente_nome}</span>}
        {event.responsavel_nome && <span>· {event.responsavel_nome}</span>}
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, color: STATUS_COLOR[event.status],
          background: `${STATUS_COLOR[event.status]}18`,
          borderRadius: 10, padding: '1px 7px',
        }}>
          {STATUS_LABEL[event.status]}
        </span>
        {event.tipo && (
          <span style={{
            fontSize: 10, fontWeight: 500, color: cor, background: `${cor}18`,
            borderRadius: 10, padding: '1px 7px', marginLeft: 4,
          }}>
            {event.tipo.nome}
          </span>
        )}
      </div>
    </div>
  )
}

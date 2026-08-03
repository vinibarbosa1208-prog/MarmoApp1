'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', expired: 'Expirado',
}
const STATUS_CLASS: Record<string, string> = {
  rascunho: 'badge-draft', enviado: 'badge-sent', aprovado: 'badge-approved', recusado: 'badge-rejected', expired: 'badge-draft',
}

export default function PerfilClientePage() {
  const params = useParams()
  const clienteId = params.id as string
  const { clientes, orcamentos } = useApp()

  const cliente = clientes.find(c => c.id === clienteId)
  const orcs = orcamentos
    .filter(o => (o.clienteId || o.cliente_id) === clienteId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const fechados = orcs.filter(o => o.status === 'aprovado')
  const totalGasto = fechados.reduce((s, o) => s + orcTotal(o), 0)
  const ticketMedio = fechados.length > 0 ? totalGasto / fechados.length : 0

  if (!cliente) return (
    <div className="page-inner">
      <p style={{ color: 'var(--gray)' }}>Cliente não encontrado. <Link href="/clientes">Voltar à lista</Link></p>
    </div>
  )

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">{cliente.nome}</h1>
          <p style={{ color: 'var(--gray)', margin: '4px 0 0', fontSize: 14 }}>
            <span className={`badge ${cliente.tipo === 'pj' ? 'badge-sent' : 'badge-draft'}`}>{cliente.tipo === 'pj' ? 'PJ' : 'PF'}</span>
            {' '}Cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Link href="/clientes" className="btn btn-outline">← Voltar</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card"><div className="card-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Total Gasto</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{totalGasto > 0 ? fmt(totalGasto) : '—'}</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Orçamentos Fechados</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fechados.length}</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Total de Orçamentos</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{orcs.length}</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Ticket Médio</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{ticketMedio > 0 ? fmt(ticketMedio) : '—'}</div>
        </div></div>
      </div>

      <div className="orcamento-view-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Histórico de Orçamentos</span></div>
            <div className="table-wrap">
              {orcs.length === 0 ? (
                <div className="empty-state"><p>Nenhum orçamento para este cliente ainda</p></div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Nº</th><th>Descrição</th><th>Status</th><th>Data</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {orcs.map(o => (
                      <tr key={o.id}>
                        <td className="text-sm text-gray">#{o.numero ?? o.id.slice(0, 6)}</td>
                        <td style={{ fontWeight: 500 }}>{o.descricao || '—'}</td>
                        <td><span className={`badge ${STATUS_CLASS[o.status] || 'badge-draft'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                        <td className="text-sm">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="font-bold">{fmt(orcTotal(o))}</td>
                        <td><Link href={`/orcamentos/${o.id}`} className="btn btn-ghost btn-sm">Ver →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Contato</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cliente.telefone && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Telefone</div>
                  <div style={{ fontSize: 14 }}>{cliente.telefone}</div>
                </div>
              )}
              {cliente.email && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
                  <div style={{ fontSize: 14 }}>{cliente.email}</div>
                </div>
              )}
              {cliente.cpf_cnpj && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>{cliente.tipo === 'pj' ? 'CNPJ' : 'CPF'}</div>
                  <div style={{ fontSize: 14 }}>{cliente.cpf_cnpj}</div>
                </div>
              )}
              {(cliente.endereco || cliente.cidade) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Endereço</div>
                  <div style={{ fontSize: 14 }}>
                    {cliente.endereco}{cliente.endereco && cliente.cidade ? ', ' : ''}{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}
                  </div>
                </div>
              )}
              {cliente.origem && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Origem</div>
                  <div style={{ fontSize: 14 }}>{cliente.origem}</div>
                </div>
              )}
              {cliente.observacoes && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--divider)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Observações</div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--dark)' }}>{cliente.observacoes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

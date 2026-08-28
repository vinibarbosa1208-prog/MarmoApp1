'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DesenhoTecnico from '@/components/orcamento/DesenhoTecnico'

interface Instalador {
  id: string
  nome: string
}

interface Cliente {
  nome: string
  telefone: string | null
  whatsapp: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
}

interface ItemObra {
  id: string
  descricao: string
  tipo_peca: string | null
  ambiente: string | null
  largura: number | null
  altura: number | null
  area: number | null
  quantidade: number
  material_nome: string | null
  desenho_tipo: string | null
  desenho_params: Record<string, unknown> | null
  instalado: boolean
}

interface Obra {
  id: string
  titulo: string
  descricao: string | null
  data_inicio: string
  status: 'agendado' | 'concluido' | 'cancelado'
  cliente: Cliente | null
  orcamento: {
    id: string
    numero_os: string | null
    observacoes: string | null
    data_prevista_instalacao: string | null
    itens: ItemObra[]
  } | null
}

const STATUS_LABEL: Record<string, string> = { agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado' }
const STATUS_COLOR: Record<string, string> = { agendado: '#2980B9', concluido: '#27AE60', cancelado: '#95A5A6' }

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
}

function ItemCard({ item }: { item: ItemObra }) {
  const [aberto, setAberto] = useState(false)
  const temDesenho = !!(item.desenho_tipo && item.desenho_params)

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.descricao}</div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
            {item.ambiente && <>{item.ambiente} · </>}
            {item.largura != null && item.altura != null && <>{item.largura}×{item.altura}m · </>}
            {item.area != null && <>{item.area.toFixed(2)}m² · </>}
            qtd {item.quantidade}
            {item.material_nome && <> · {item.material_nome}</>}
          </div>
        </div>
        {item.instalado && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#27AE60', background: '#27AE6018', borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>
            ✓ Instalado
          </span>
        )}
      </div>
      {temDesenho && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setAberto(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {aberto ? '▲ Ocultar desenho' : '▼ Ver desenho técnico'}
          </button>
          {aberto && (
            <div style={{ marginTop: 8 }}>
              <DesenhoTecnico params={{ tipo_peca: item.desenho_tipo || '', ...(item.desenho_params ?? {}) }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ObraCard({ obra }: { obra: Obra }) {
  const c = obra.cliente
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', background: 'var(--marble)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{obra.titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--gray)' }}>{fmtData(obra.data_inicio)}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[obra.status], background: `${STATUS_COLOR[obra.status]}18`, borderRadius: 10, padding: '3px 10px' }}>
          {STATUS_LABEL[obra.status]}
        </span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {c && (
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{c.nome}</div>
            {(c.telefone || c.whatsapp) && (
              <div style={{ color: 'var(--gray)' }}>
                {c.whatsapp && <a href={`tel:${c.whatsapp}`} style={{ color: 'var(--gold)' }}>{c.whatsapp}</a>}
                {!c.whatsapp && c.telefone && <a href={`tel:${c.telefone}`} style={{ color: 'var(--gold)' }}>{c.telefone}</a>}
              </div>
            )}
            {(c.endereco || c.cidade) && (
              <div style={{ color: 'var(--gray)', marginTop: 2 }}>
                {[c.endereco, c.cidade, c.estado].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {obra.orcamento?.observacoes && (
          <div style={{ fontSize: 13, color: 'var(--gray)', background: 'var(--light)', borderRadius: 6, padding: 10 }}>
            {obra.orcamento.observacoes}
          </div>
        )}

        {obra.descricao && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{obra.descricao}</div>}

        {obra.orcamento && obra.orcamento.itens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Peças</div>
            {obra.orcamento.itens.map(i => <ItemCard key={i.id} item={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PortalInstaladorObrasPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [instalador, setInstalador] = useState<Instalador | null>(null)
  const [obras, setObras] = useState<Obra[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/portal-instalador/funcionario/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setInstalador)
      .catch(() => setErro('Instalador não encontrado.'))
    fetch(`/api/portal-instalador/obras/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setObras)
      .catch(() => setErro(prev => prev || 'Não foi possível carregar suas obras.'))
  }, [id])

  if (erro) {
    return (
      <div>
        <p style={{ color: 'var(--red)', marginBottom: 16 }}>{erro}</p>
        <button className="btn btn-outline btn-sm" onClick={() => router.push('/portal-instalador')}>← Voltar</button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => router.push('/portal-instalador')}
        style={{ background: 'none', border: 'none', color: 'var(--gray)', fontSize: 13, marginBottom: 12, cursor: 'pointer', padding: 0 }}
      >
        ← Trocar pessoa
      </button>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>
        Olá, {instalador?.nome ?? '…'}
      </h1>
      <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 20 }}>
        Suas obras atribuídas
      </p>

      {obras === null && <div style={{ color: 'var(--gray)' }}>Carregando…</div>}
      {obras?.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', color: 'var(--gray)', fontSize: 14 }}>
          Nenhuma obra atribuída a você ainda. O gestor precisa te colocar como responsável num evento de &ldquo;Entrega/Instalação&rdquo; na agenda.
        </div>
      )}
      {obras?.map(o => <ObraCard key={o.id} obra={o} />)}
    </div>
  )
}

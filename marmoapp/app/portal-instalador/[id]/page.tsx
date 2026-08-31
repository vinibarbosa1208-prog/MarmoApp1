'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DesenhoTecnico from '@/components/orcamento/DesenhoTecnico'

interface Instalador {
  id: string
  nome: string
  valor_metro_linear: number | null
  // Fase 12: valores padronizados por tipo de peça (R$/metro linear) —
  // pré-preenche por peça; sem entrada específica cai no valor_metro_linear.
  valores_peca: Record<string, number>
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

function fmtValor(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

// Formulário de registro: metro linear + valor sugerido (editável) + foto
// obrigatória. Some quando o item já está instalado ou quando a obra
// inteira já foi concluída.
function RegistrarItemForm({ funcionarioId, agendaEventId, item, valorMetroLinearPadrao, onRegistrado }: {
  funcionarioId: string
  agendaEventId: string
  item: ItemObra
  valorMetroLinearPadrao: number | null
  onRegistrado: (valorCalculado: number, obraConcluida: boolean) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [metros, setMetros] = useState('')
  // Pré-preenchido com o padrão do cadastro, mas editável — peças menores
  // (pingadeira, soleira etc.) valem menos que o padrão.
  const [valorMetro, setValorMetro] = useState(() => valorMetroLinearPadrao != null ? String(valorMetroLinearPadrao) : '')
  const [foto, setFoto] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const metrosNum = parseFloat(metros.replace(',', '.'))
  const valorMetroNum = parseFloat(valorMetro.replace(',', '.'))
  const totalPreview = (metrosNum > 0 && valorMetroNum > 0) ? metrosNum * valorMetroNum : null

  async function salvar() {
    if (!metrosNum || metrosNum <= 0) { setErro('Informe o metro linear'); return }
    if (!valorMetroNum || valorMetroNum <= 0) { setErro('Informe o valor por metro'); return }
    if (!foto) { setErro('A foto é obrigatória'); return }
    setSalvando(true)
    setErro('')
    try {
      const fd = new FormData()
      fd.set('funcionario_id', funcionarioId)
      fd.set('agenda_event_id', agendaEventId)
      fd.set('orcamento_item_id', item.id)
      fd.set('metros_lineares', String(metrosNum))
      fd.set('valor_metro_linear_aplicado', String(valorMetroNum))
      fd.set('foto', foto)
      const res = await fetch('/api/portal-instalador/registrar-item', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao registrar')
      onRegistrado(json.valor_calculado, json.obra_concluida)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="btn btn-gold btn-sm"
        style={{ marginTop: 8 }}
      >
        Marcar como instalada
      </button>
    )
  }

  return (
    <div style={{ marginTop: 10, background: 'var(--light)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Metro linear</label>
        <input
          type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={metros} onChange={e => { setMetros(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Valor sugerido por metro (R$)</label>
        <input
          type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={valorMetro} onChange={e => { setValorMetro(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
        <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
          Peças menores (pingadeira, soleira etc.) costumam valer menos que o padrão. O gestor confere no fechamento semanal.
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Foto da instalação *</label>
        <input
          type="file" accept="image/*" capture="environment"
          onChange={e => { setFoto(e.target.files?.[0] ?? null); setErro('') }}
          style={{ marginTop: 4, display: 'block', fontSize: 13 }}
        />
      </div>
      {totalPreview != null && (
        <div style={{ fontSize: 13, fontWeight: 600 }}>Valor sugerido: {fmtValor(totalPreview)}</div>
      )}
      {erro && <div style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</button>
        <button className="btn btn-gold btn-sm" onClick={salvar} disabled={salvando}>
          {salvando ? 'Enviando...' : '✓ Confirmar instalação'}
        </button>
      </div>
    </div>
  )
}

// Serviço avulso — obra que nunca vai ter orçamento no MarmoApp (obra
// antiga, cliente atendido fora do sistema). Mesmo padrão visual do
// RegistrarItemForm (metro + valor sugerido editável + foto), mas com
// nome do cliente e local em texto livre em vez de um item de orçamento.
function RegistrarAvulsoForm({ funcionarioId, valorMetroLinearPadrao }: {
  funcionarioId: string
  valorMetroLinearPadrao: number | null
}) {
  const [aberto, setAberto] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [local, setLocal] = useState('')
  const [metros, setMetros] = useState('')
  const [valorMetro, setValorMetro] = useState(() => valorMetroLinearPadrao != null ? String(valorMetroLinearPadrao) : '')
  const [foto, setFoto] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const metrosNum = parseFloat(metros.replace(',', '.'))
  const valorMetroNum = parseFloat(valorMetro.replace(',', '.'))
  const totalPreview = (metrosNum > 0 && valorMetroNum > 0) ? metrosNum * valorMetroNum : null

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }
    if (!local.trim()) { setErro('Informe o local/referência da obra'); return }
    if (!metrosNum || metrosNum <= 0) { setErro('Informe o metro linear'); return }
    if (!valorMetroNum || valorMetroNum <= 0) { setErro('Informe o valor por metro'); return }
    if (!foto) { setErro('A foto é obrigatória'); return }
    setSalvando(true)
    setErro('')
    setSucesso(false)
    try {
      const fd = new FormData()
      fd.set('funcionario_id', funcionarioId)
      fd.set('obra_nome_avulso', clienteNome.trim())
      fd.set('obra_local_avulso', local.trim())
      fd.set('metros_lineares', String(metrosNum))
      fd.set('valor_metro_linear_aplicado', String(valorMetroNum))
      fd.set('foto', foto)
      const res = await fetch('/api/portal-instalador/registrar-avulso', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao registrar')
      setSucesso(true)
      setClienteNome('')
      setLocal('')
      setMetros('')
      setFoto(null)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => { setAberto(true); setSucesso(false) }}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: 20 }}
      >
        + Registrar serviço avulso (obra fora do sistema)
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: 'var(--shadow)', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Serviço avulso (obra fora do sistema)</div>
      <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: -4, marginBottom: 4 }}>
        Pra obras antigas ou clientes que não estão cadastrados no MarmoApp.
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Nome do cliente</label>
        <input
          type="text" placeholder="Ex: José da Silva"
          value={clienteNome} onChange={e => { setClienteNome(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Local / referência da obra</label>
        <input
          type="text" placeholder="Ex: Rua das Flores, 123 — Itaquá"
          value={local} onChange={e => { setLocal(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Metro linear</label>
        <input
          type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={metros} onChange={e => { setMetros(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Valor sugerido por metro (R$)</label>
        <input
          type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={valorMetro} onChange={e => { setValorMetro(e.target.value); setErro('') }}
          className="form-input" style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Foto da instalação *</label>
        <input
          type="file" accept="image/*" capture="environment"
          onChange={e => { setFoto(e.target.files?.[0] ?? null); setErro('') }}
          style={{ marginTop: 4, display: 'block', fontSize: 13 }}
        />
      </div>
      {totalPreview != null && (
        <div style={{ fontSize: 13, fontWeight: 600 }}>Valor sugerido: {fmtValor(totalPreview)}</div>
      )}
      {sucesso && <div style={{ color: '#27AE60', fontSize: 13, fontWeight: 600 }}>✓ Registrado! Vai aparecer no fechamento semanal do gestor.</div>}
      {erro && <div style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setAberto(false)} disabled={salvando}>Fechar</button>
        <button className="btn btn-gold btn-sm" onClick={salvar} disabled={salvando}>
          {salvando ? 'Enviando...' : '✓ Confirmar registro'}
        </button>
      </div>
    </div>
  )
}

function ItemCard({ item, funcionarioId, agendaEventId, obraStatus, valorMetroLinear, valoresPeca, onRegistrado }: {
  item: ItemObra
  funcionarioId: string
  agendaEventId: string
  obraStatus: Obra['status']
  valorMetroLinear: number | null
  valoresPeca: Record<string, number>
  onRegistrado: (valorCalculado: number, obraConcluida: boolean) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [valorRegistrado, setValorRegistrado] = useState<number | null>(null)
  const temDesenho = !!(item.desenho_tipo && item.desenho_params)
  // Fase 12: valor específico do instalador pra esse tipo de peça, se ele
  // tiver cadastrado; senão cai no valor_metro_linear geral do cadastro.
  const valorPadraoDaPeca = (item.tipo_peca ? valoresPeca[item.tipo_peca] : undefined) ?? valorMetroLinear

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
            ✓ Instalado{valorRegistrado != null && <> · {fmtValor(valorRegistrado)}</>}
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
      {!item.instalado && obraStatus === 'agendado' && (
        <RegistrarItemForm
          funcionarioId={funcionarioId}
          agendaEventId={agendaEventId}
          item={item}
          valorMetroLinearPadrao={valorPadraoDaPeca}
          onRegistrado={(valor, obraConcluida) => { setValorRegistrado(valor); onRegistrado(valor, obraConcluida) }}
        />
      )}
    </div>
  )
}

function ObraCard({ obra, funcionarioId, valorMetroLinear, valoresPeca, onObraAtualizada }: {
  obra: Obra
  funcionarioId: string
  valorMetroLinear: number | null
  valoresPeca: Record<string, number>
  onObraAtualizada: (obraId: string, itemId: string, obraConcluida: boolean) => void
}) {
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
        {obra.status === 'concluido' && (
          <div style={{ background: '#27AE6018', color: '#27AE60', borderRadius: 6, padding: 10, fontSize: 13, fontWeight: 600 }}>
            🎉 Obra concluída — todas as peças foram instaladas.
          </div>
        )}

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
            {obra.orcamento.itens.map(i => (
              <ItemCard
                key={i.id}
                item={i}
                funcionarioId={funcionarioId}
                agendaEventId={obra.id}
                obraStatus={obra.status}
                valorMetroLinear={valorMetroLinear}
                valoresPeca={valoresPeca}
                onRegistrado={(_valor, obraConcluida) => onObraAtualizada(obra.id, i.id, obraConcluida)}
              />
            ))}
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

  // Atualiza localmente sem precisar recarregar tudo — marca o item como
  // instalado e, se a obra concluiu, atualiza o status pra 'concluido'.
  function onObraAtualizada(obraId: string, itemId: string, obraConcluida: boolean) {
    setObras(prev => prev?.map(o => {
      if (o.id !== obraId || !o.orcamento) return o
      return {
        ...o,
        status: obraConcluida ? 'concluido' : o.status,
        orcamento: {
          ...o.orcamento,
          itens: o.orcamento.itens.map(i => i.id === itemId ? { ...i, instalado: true } : i),
        },
      }
    }) ?? null)
  }

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
      <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 12 }}>
        Suas obras atribuídas
      </p>

      <RegistrarAvulsoForm funcionarioId={id} valorMetroLinearPadrao={instalador?.valor_metro_linear ?? null} />

      {obras === null && <div style={{ color: 'var(--gray)' }}>Carregando…</div>}
      {obras?.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', color: 'var(--gray)', fontSize: 14 }}>
          Nenhuma obra atribuída a você ainda. O gestor precisa te colocar como responsável num evento de &ldquo;Entrega/Instalação&rdquo; na agenda.
        </div>
      )}
      {obras?.map(o => (
        <ObraCard
          key={o.id}
          obra={o}
          funcionarioId={id}
          valorMetroLinear={instalador?.valor_metro_linear ?? null}
          valoresPeca={instalador?.valores_peca ?? {}}
          onObraAtualizada={onObraAtualizada}
        />
      ))}
    </div>
  )
}

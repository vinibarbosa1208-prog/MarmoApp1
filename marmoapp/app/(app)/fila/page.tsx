'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { fmt, orcTotal, areaCortadaItens, mlAcabamentoItens } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Orcamento, OrcamentoItem } from '@/lib/types'

interface Funcionario { id: string; nome: string; cargo: string; valor_metro_linear: number | null; ativo: boolean }

function InstalarModal({ orcId, orcLabel, instaladores, onClose, onSaved }: {
  orcId: string
  orcLabel: string
  instaladores: Funcionario[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useApp()
  const [form, setForm] = useState({
    funcionario_id: '',
    data: new Date().toISOString().split('T')[0],
    metros_lineares: '',
    valor_metro_linear: '',
  })
  const [saving, setSaving] = useState(false)

  function handleInstalador(id: string) {
    const f = instaladores.find(i => i.id === id)
    setForm(prev => ({ ...prev, funcionario_id: id, valor_metro_linear: String(f?.valor_metro_linear ?? '') }))
  }

  const total = (parseFloat(form.metros_lineares) || 0) * (parseFloat(form.valor_metro_linear) || 0)

  async function salvar() {
    if (!form.funcionario_id) { toast('Selecione um instalador', 'err'); return }
    if (!form.metros_lineares || parseFloat(form.metros_lineares) <= 0) { toast('Metros inválidos', 'err'); return }
    setSaving(true)
    const res = await fetch('/api/funcionarios/instalacoes', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        funcionario_id: form.funcionario_id,
        ordem_servico_id: orcId,
        data: form.data,
        metros_lineares: parseFloat(form.metros_lineares),
        valor_metro_linear: parseFloat(form.valor_metro_linear) || 0,
      }),
    })
    if (res.ok) {
      toast('Instalação registrada', 'ok2')
      onSaved()
      onClose()
    } else {
      const d = await res.json()
      toast(d.error || 'Erro ao registrar', 'err')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Atribuir Instalador</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Orçamento: <b>{orcLabel}</b></div>
          <div className="form-group">
            <label className="form-label">INSTALADOR</label>
            <select className="form-select" value={form.funcionario_id} onChange={e => handleInstalador(e.target.value)}>
              <option value="">— Selecionar —</option>
              {instaladores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">DATA</label>
              <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">METROS LINEARES</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.metros_lineares} onChange={e => setForm(f => ({ ...f, metros_lineares: e.target.value }))} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">VALOR/METRO (R$)</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.valor_metro_linear} onChange={e => setForm(f => ({ ...f, valor_metro_linear: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">TOTAL</label>
              <div className="form-input" style={{ background: 'var(--light)', fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center' }}>{fmt(total)}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '💾 Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

function PrevisaoModal({ orcLabel, dataInicial, onCancelar, onConfirmar }: {
  orcLabel: string
  dataInicial: string
  onCancelar: () => void
  onConfirmar: (data: string) => void
}) {
  const [data, setData] = useState(dataInicial)

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Data Prevista de Instalação</div>
          <button className="btn-close" onClick={onCancelar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Orçamento: <b>{orcLabel}</b></div>
          <div className="form-group">
            <label className="form-label">PREVISÃO DE INSTALAÇÃO (OPCIONAL)</label>
            <input className="form-input" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Você vai receber um alerta na Fila de Serviços conforme essa data se aproximar. Pode deixar em branco e preencher depois.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => onConfirmar('')}>Pular</button>
          <button className="btn btn-gold" onClick={() => onConfirmar(data)}>Salvar e Avançar</button>
        </div>
      </div>
    </div>
  )
}

// Itens de um pedido relevantes pra medir Corte (têm área) ou Acabamento (têm ao menos um lado com acabamento)
function itensRelevantesCorte(itens: OrcamentoItem[]): OrcamentoItem[] {
  return itens.filter(i => (i.area || 0) > 0)
}
function itensRelevantesAcabamento(itens: OrcamentoItem[]): OrcamentoItem[] {
  return itens.filter(i => mlAcabamentoItens([i]) > 0)
}

function RegistrarProducaoModal({ orcLabel, etapa, itensPendentes, funcionarios, onCancelar, onSalvar }: {
  orcLabel: string
  etapa: 'corte' | 'acabamento'
  itensPendentes: OrcamentoItem[]
  funcionarios: Funcionario[]
  onCancelar: () => void
  onSalvar: (itensSelecionadosIds: string[], funcionarioId: string, data: string) => void
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(itensPendentes.map(i => i.id!)))
  const [funcionarioId, setFuncionarioId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro] = useState('')

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const itensSelecionados = itensPendentes.filter(i => selecionados.has(i.id!))
  const totalMedido = etapa === 'corte' ? areaCortadaItens(itensSelecionados) : mlAcabamentoItens(itensSelecionados)
  const unidade = etapa === 'corte' ? 'm²' : 'ml'
  const cargoLabel = etapa === 'corte' ? 'Serrador' : 'Acabador'

  function confirmar() {
    if (selecionados.size === 0) { setErro('Selecione ao menos uma peça'); return }
    if (!funcionarioId) { setErro(`Selecione o ${cargoLabel.toLowerCase()} responsável`); return }
    onSalvar(Array.from(selecionados), funcionarioId, data)
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">Registrar {etapa === 'corte' ? 'Corte' : 'Acabamento'}</div>
          <button className="btn-close" onClick={onCancelar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Orçamento: <b>{orcLabel}</b></div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 6 }}>
            Peças concluídas hoje (desmarque as que ainda não)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
            {itensPendentes.map(i => (
              <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 8px', background: 'var(--light)', borderRadius: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={selecionados.has(i.id!)} onChange={() => toggle(i.id!)} />
                <span style={{ flex: 1 }}>{i.descricao}</span>
                <span style={{ color: 'var(--gray)', fontSize: 12 }}>
                  {etapa === 'corte' ? `${((i.area || 0) * (i.quantidade || 1)).toFixed(2)} m²` : `${mlAcabamentoItens([i]).toFixed(2)} ml`}
                </span>
              </label>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">{cargoLabel.toUpperCase()} RESPONSÁVEL</label>
            <select className="form-select" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
              <option value="">— Selecionar —</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">DATA</label>
            <input className="form-input" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>
            Total: {totalMedido.toFixed(2)} {unidade}
          </div>
          {erro && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-gold" onClick={confirmar}>💾 Registrar</button>
        </div>
      </div>
    </div>
  )
}

// Dias entre hoje e uma data (positivo = no futuro, negativo = atrasado)
function diasAte(dataStr: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(dataStr + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

// Dias parado na etapa atual
function diasNaEtapa(dataStr?: string): number {
  if (!dataStr) return 0
  const desde = new Date(dataStr)
  const hoje = new Date()
  return Math.max(0, Math.floor((hoje.getTime() - desde.getTime()) / 86400000))
}

function corSinalEtapa(dias: number): string {
  if (dias >= 7) return '#E74C3C'
  if (dias >= 3) return '#F39C12'
  return '#27AE60'
}

function corPrevisao(dias: number): string {
  if (dias < 0) return '#E74C3C'
  if (dias <= 3) return '#E74C3C'
  if (dias <= 7) return '#F39C12'
  return 'var(--text-muted)'
}

const PIPELINE = [
  { id: 'comercial',         label: 'Comercial',           cor: '#2980B9' },
  { id: 'corte',             label: 'Corte',               cor: '#8E44AD' },
  { id: 'acabamento',        label: 'Acabamento',          cor: '#E67E22' },
  { id: 'aguardando_data',   label: 'Aguardando Data',     cor: '#16A085' },
  { id: 'instalacao',        label: 'Instalação Confirmada', cor: '#27AE60' },
  { id: 'finalizado',        label: 'Finalizado',          cor: '#2C3E50' },
]

const FILA_TO_ETAPA: Record<string, string> = {
  corte: 'producao',
  aguardando_data: 'pronto',
  instalacao: 'agendado',
  finalizado: 'concluido',
}

export default function FilaPage() {
  const { orcamentos, clientes, marmoraria, loadOrcamentos, toast } = useApp()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [itensPorOrc, setItensPorOrc] = useState<Record<string, OrcamentoItem[]>>({})
  const [instalarModal, setInstalarModal] = useState<{ open: boolean; orcId: string; orcLabel: string }>({ open: false, orcId: '', orcLabel: '' })
  const [previsaoModal, setPrevisaoModal] = useState<{ open: boolean; orcId: string; orcLabel: string; dataAtual: string }>({ open: false, orcId: '', orcLabel: '', dataAtual: '' })
  const [registrarModal, setRegistrarModal] = useState<{ open: boolean; orcId: string; orcLabel: string; etapa: 'corte' | 'acabamento'; itensPendentes: OrcamentoItem[] }>({ open: false, orcId: '', orcLabel: '', etapa: 'corte', itensPendentes: [] })
  const [projetoMap, setProjetoMap] = useState<Record<string, string>>({})

  const instaladores = funcionarios.filter(f => f.cargo === 'instalador')
  const serradores = funcionarios.filter(f => f.cargo === 'serrador')
  const acabadores = funcionarios.filter(f => f.cargo === 'acabador')

  useEffect(() => {
    fetch('/api/funcionarios', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Funcionario[]) => setFuncionarios(data.filter(f => f.ativo)))
    fetch('/api/projetos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; orcamento_id?: string | null }[]) => {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.orcamento_id) map[p.orcamento_id] = p.id })
        setProjetoMap(map)
      })
  }, [])

  const ativos = orcamentos.filter(o => o.crm_status !== 'perdido' && (o.crm_status === 'fechado' || o.producao_status))

  // Carrega os itens dos pedidos que estão em Corte ou Acabamento (é o que
  // precisa da checklist por peça). Recarrega sempre que a lista de pedidos
  // nessas duas etapas mudar.
  const idsCorteAcabamento = ativos
    .filter(o => ((o.producao_status || 'comercial') as string) === 'corte' || ((o.producao_status || 'comercial') as string) === 'acabamento')
    .map(o => o.id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = idsCorteAcabamento ? idsCorteAcabamento.split(',') : []
    if (ids.length === 0) { setItensPorOrc({}); return }
    supabase.from('orcamento_itens').select('*').in('orcamento_id', ids).then(({ data }) => {
      const porOrc: Record<string, OrcamentoItem[]> = {}
      for (const i of (data || [])) {
        const oid = i.orcamento_id as string
        if (!porOrc[oid]) porOrc[oid] = []
        porOrc[oid].push(i)
      }
      setItensPorOrc(porOrc)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsCorteAcabamento])

  async function recarregarItensOrc(orcId: string) {
    const { data } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcId)
    setItensPorOrc(prev => ({ ...prev, [orcId]: data || [] }))
  }

  // Pedidos com instalação prevista pra até 7 dias (ou já atrasados) — usados no banner de alerta
  const alertasInstalacao = ativos
    .filter(o => (o as any).data_prevista_instalacao && ((o.producao_status || 'comercial') as string) !== 'finalizado')
    .map(o => ({ orc: o, dias: diasAte((o as any).data_prevista_instalacao) }))
    .filter(a => a.dias <= 7)
    .sort((a, b) => a.dias - b.dias)

  async function avancar(orcId: string, novoStatus: string, etapaAtual: string) {
    // Saindo de Comercial pra Corte: pede a data prevista de instalação antes de avançar
    if (novoStatus === 'corte') {
      const orc = ativos.find(o => o.id === orcId)
      setPrevisaoModal({
        open: true,
        orcId,
        orcLabel: orc?.descricao || `Orç. #${orc?.numero || orcId.slice(0, 6)}`,
        dataAtual: (orc as any)?.data_prevista_instalacao || '',
      })
      return
    }
    await avancarConfirmado(orcId, novoStatus, etapaAtual)
  }

  // Abre o registro de produção por peça pra Corte/Acabamento. Se não há
  // peças pendentes pra medir nessa etapa (ex: pedido só com itens de
  // serviço/frete), avança direto sem checklist.
  function abrirRegistrarProducao(o: Orcamento, etapaId: 'corte' | 'acabamento') {
    const todosItens = itensPorOrc[o.id] || []
    const relevantes = etapaId === 'corte' ? itensRelevantesCorte(todosItens) : itensRelevantesAcabamento(todosItens)
    const pendentes = relevantes.filter(i => etapaId === 'corte' ? !i.cortado_em : !i.acabado_em)
    const proxEtapaId = etapaId === 'corte' ? 'acabamento' : 'aguardando_data'

    if (relevantes.length === 0) {
      avancarConfirmado(o.id, proxEtapaId, etapaId)
      return
    }
    setRegistrarModal({
      open: true,
      orcId: o.id,
      orcLabel: o.descricao || `Orç. #${o.numero || o.id.slice(0, 6)}`,
      etapa: etapaId,
      itensPendentes: pendentes,
    })
  }

  // Salva o apontamento das peças marcadas (com quem fez e quando) e, se
  // essas eram as últimas peças pendentes dessa etapa, avança o pedido
  // inteiro automaticamente pra próxima.
  async function onProducaoSalva(itensIds: string[], funcionarioId: string, data: string) {
    const { orcId, etapa, itensPendentes } = registrarModal
    setRegistrarModal({ open: false, orcId: '', orcLabel: '', etapa: 'corte', itensPendentes: [] })
    if (!marmoraria) return

    const itensSelecionados = itensPendentes.filter(i => itensIds.includes(i.id!))
    const quantidade = etapa === 'corte' ? areaCortadaItens(itensSelecionados) : mlAcabamentoItens(itensSelecionados)
    const campoData = etapa === 'corte' ? 'cortado_em' : 'acabado_em'
    const campoPor = etapa === 'corte' ? 'cortado_por' : 'acabado_por'

    await supabase.from('orcamento_itens')
      .update({ [campoData]: new Date().toISOString(), [campoPor]: funcionarioId })
      .in('id', itensIds)

    if (quantidade > 0) {
      await supabase.from('producao_apontamentos').insert({
        marmoraria_id: marmoraria.id,
        orcamento_id: orcId,
        etapa,
        quantidade,
        unidade: etapa === 'corte' ? 'm2' : 'ml',
        data,
        origem: 'automatico',
        funcionario_id: funcionarioId,
      })
    }

    const restantes = itensPendentes.filter(i => !itensIds.includes(i.id!))
    await recarregarItensOrc(orcId)

    if (restantes.length === 0) {
      // Não sobrou nenhuma peça pendente — o pedido inteiro avança de etapa
      const proxEtapaId = etapa === 'corte' ? 'acabamento' : 'aguardando_data'
      await avancarConfirmado(orcId, proxEtapaId, etapa)
    } else {
      await loadOrcamentos()
      toast(`Produção registrada — ${restantes.length} peça${restantes.length > 1 ? 's' : ''} ainda pendente${restantes.length > 1 ? 's' : ''}`, 'ok2')
    }
  }

  async function avancarConfirmado(orcId: string, novoStatus: string, etapaAtual: string, dataPrevista?: string) {
    const payload: Record<string, unknown> = {
      producao_status: novoStatus,
      producao_status_atualizado_em: new Date().toISOString(),
    }
    if (dataPrevista !== undefined) payload.data_prevista_instalacao = dataPrevista || null

    const { error } = await supabase.from('orcamentos').update(payload).eq('id', orcId)
    if (error) { toast('Erro: ' + error.message, 'err'); return }
    // Produção de Corte/Acabamento já é registrada peça a peça em
    // onProducaoSalva — não duplicar apontamento aqui.
    const etapa = FILA_TO_ETAPA[novoStatus]
    const projetoId = projetoMap[orcId]
    if (etapa && projetoId) {
      fetch(`/api/projetos/${projetoId}/etapas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa }),
      })
    }
    await loadOrcamentos()
    toast('Pedido avançado!', 'ok2')
  }

  async function voltar(orcId: string, statusAnterior: string, labelAnterior: string) {
    if (!confirm(`Voltar para ${labelAnterior}?`)) return
    const { error } = await supabase.from('orcamentos').update({
      producao_status: statusAnterior,
      producao_status_atualizado_em: new Date().toISOString(),
    }).eq('id', orcId)
    if (error) { toast('Erro: ' + error.message, 'err'); return }
    await loadOrcamentos()
    toast(`Voltou para ${labelAnterior}`, 'ok2')
  }

  async function marcarPerdido(orcId: string) {
    if (!confirm('Marcar este orçamento como perdido? Ele sai da Fila de Serviços (continua no CRM de Orçamentos).')) return
    const { error } = await supabase.from('orcamentos').update({ crm_status: 'perdido' }).eq('id', orcId)
    if (error) { toast('Erro: ' + error.message, 'err'); return }
    await loadOrcamentos()
    toast('Orçamento marcado como perdido', 'ok2')
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Fila de Serviços</h1>
      </div>

      {alertasInstalacao.length > 0 && (
        <div style={{ background: '#FDEDEC', border: '1px solid #F5B7B1', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', marginBottom: 6 }}>
            ⚠️ {alertasInstalacao.length} instalação{alertasInstalacao.length > 1 ? 'ões' : ''} {alertasInstalacao.some(a => a.dias < 0) ? 'atrasada(s) ou ' : ''}chegando
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alertasInstalacao.map(a => (
              <div key={a.orc.id} style={{ fontSize: 12, color: '#922B21' }}>
                <b>{a.orc.descricao || `Orç. #${a.orc.numero || a.orc.id.slice(0, 6)}`}</b>
                {' — '}
                {a.dias < 0
                  ? `atrasada há ${Math.abs(a.dias)} dia${Math.abs(a.dias) > 1 ? 's' : ''}`
                  : a.dias === 0
                    ? 'instalação prevista para hoje'
                    : `instalação em ${a.dias} dia${a.dias > 1 ? 's' : ''}`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0', minHeight: 400 }}>
        {PIPELINE.map((etapa, idx) => {
          const cards = ativos.filter(o => (o.producao_status || 'comercial') === etapa.id)
          const proxEtapa = idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null
          const etapaAnterior = idx > 0 ? PIPELINE[idx - 1] : null

          return (
            <div key={etapa.id} style={{ minWidth: 200, flex: 1, background: 'var(--page-bg)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
              <div style={{ background: etapa.cor, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{etapa.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {cards.length}
                </span>
              </div>

              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Nenhum pedido</div>
                ) : cards.map(o => {
                  const cli = clientes.find(c => c.id === (o.clienteId || o.cliente_id))
                  const totalVal = orcTotal(o)
                  const dataPrevista = (o as any).data_prevista_instalacao as string | undefined
                  const diasParado = diasNaEtapa((o as any).producao_status_atualizado_em)

                  const isCorteOuAcabamento = etapa.id === 'corte' || etapa.id === 'acabamento'
                  const todosItens = itensPorOrc[o.id] || []
                  const relevantes = etapa.id === 'corte' ? itensRelevantesCorte(todosItens) : etapa.id === 'acabamento' ? itensRelevantesAcabamento(todosItens) : []
                  const concluidos = relevantes.filter(i => etapa.id === 'corte' ? i.cortado_em : i.acabado_em)

                  return (
                    <div key={o.id} style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${etapa.cor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}`}
                        </div>
                        {etapa.id !== 'finalizado' && (
                          <span
                            title={`${diasParado} dia${diasParado !== 1 ? 's' : ''} nesta etapa`}
                            style={{ width: 9, height: 9, borderRadius: '50%', background: corSinalEtapa(diasParado), flexShrink: 0, marginTop: 3 }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{cli?.nome || '—'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: etapa.cor, marginBottom: 4 }}>{fmt(totalVal)}</div>

                      {isCorteOuAcabamento && relevantes.length > 1 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                          {relevantes.map(i => (
                            <div key={i.id} style={{ display: 'flex', gap: 4 }}>
                              <span>{(etapa.id === 'corte' ? i.cortado_em : i.acabado_em) ? '✅' : '⬜'}</span>
                              <span>{i.descricao}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {dataPrevista && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: corPrevisao(diasAte(dataPrevista)), marginBottom: 8 }}>
                          📅 Instalação: {new Date(dataPrevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      {!dataPrevista && <div style={{ marginBottom: 8 }} />}
                      {etapa.id === 'comercial' && (
                        <button
                          onClick={() => marcarPerdido(o.id)}
                          style={{ width: '100%', background: 'none', border: '1px solid #F5B7B1', borderRadius: 6, padding: 6, color: '#C0392B', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
                        >
                          🚫 Marcar como Perdido
                        </button>
                      )}
                      {etapa.id === 'instalacao' && (
                        <button
                          onClick={() => setInstalarModal({ open: true, orcId: o.id, orcLabel: o.descricao || `Orç. #${o.numero || o.id.slice(0,6)}` })}
                          style={{ width: '100%', background: '#16A085', border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
                        >
                          👷 Atribuir Instalador
                        </button>
                      )}
                      {etapaAnterior && (
                        <button
                          onClick={() => voltar(o.id, etapaAnterior.id, etapaAnterior.label)}
                          style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
                        >
                          ← {etapaAnterior.label}
                        </button>
                      )}
                      {isCorteOuAcabamento ? (
                        <button
                          onClick={() => abrirRegistrarProducao(o, etapa.id as 'corte' | 'acabamento')}
                          style={{ width: '100%', background: etapa.cor, border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {relevantes.length > 1 ? `📋 Registrar (${concluidos.length}/${relevantes.length})` : '📋 Registrar Produção'}
                        </button>
                      ) : proxEtapa ? (
                        <button
                          onClick={() => avancar(o.id, proxEtapa.id, etapa.id)}
                          style={{ width: '100%', background: etapa.cor, border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          → {proxEtapa.label}
                        </button>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✅ Concluído</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {instalarModal.open && (
        <InstalarModal
          orcId={instalarModal.orcId}
          orcLabel={instalarModal.orcLabel}
          instaladores={instaladores}
          onClose={() => setInstalarModal({ open: false, orcId: '', orcLabel: '' })}
          onSaved={loadOrcamentos}
        />
      )}

      {previsaoModal.open && (
        <PrevisaoModal
          orcLabel={previsaoModal.orcLabel}
          dataInicial={previsaoModal.dataAtual}
          onCancelar={() => setPrevisaoModal({ open: false, orcId: '', orcLabel: '', dataAtual: '' })}
          onConfirmar={(data) => {
            avancarConfirmado(previsaoModal.orcId, 'corte', 'comercial', data)
            setPrevisaoModal({ open: false, orcId: '', orcLabel: '', dataAtual: '' })
          }}
        />
      )}

      {registrarModal.open && (
        <RegistrarProducaoModal
          orcLabel={registrarModal.orcLabel}
          etapa={registrarModal.etapa}
          itensPendentes={registrarModal.itensPendentes}
          funcionarios={registrarModal.etapa === 'corte' ? serradores : acabadores}
          onCancelar={() => setRegistrarModal({ open: false, orcId: '', orcLabel: '', etapa: 'corte', itensPendentes: [] })}
          onSalvar={onProducaoSalva}
        />
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import {
  resumoAdesao, STATUS_LABEL, STATUS_PAGANDO, STATUS_NA_FILA, fmtReais, fmtData, fmtMesAno, fmtCpf, fmtFone, hojeSP,
  type StatusAdesao,
} from '@/lib/minha-pia/regras'

interface Adesao {
  id: string; numero: number; kit_id: string; kit_nome: string; valor_total: number; valor_parcela: number; dia_vencimento: number
  nome: string; cpf: string; whatsapp: string; email: string | null; endereco: string | null; numero_endereco: string | null
  complemento: string | null; bairro: string | null; cidade: string; cep: string | null
  status: StatusAdesao; total_pago: number; desconto: number; quitada_em: string | null
  medicao_data: string | null; instalacao_data: string | null; instalada_em: string | null
  antecipacao_solicitada_em: string | null; oferta_quitacao_valor: number | null; oferta_validade: string | null; oferta_mensagem: string | null
  utm_source: string | null; utm_campaign: string | null; created_at: string
}
interface Kit { id: string; codigo: string; nome: string; grupo: string; material_nome: string; preco_total: number; custo_base: number; ativo: boolean }
interface Config {
  ativo: boolean; prazo_entrega_dias: number; cidades_atendidas: string[]; parcelas_opcoes: number[]
  whatsapp_contato: string | null; pix_chave: string | null; pix_favorecido: string | null
}
interface Espera { id: string; nome: string; whatsapp: string; cidade: string; kit_codigo: string | null; created_at: string }
interface Dados { adesoes: Adesao[]; kits: Kit[]; config: Config; lista_espera: Espera[]; asaas: boolean }
interface Pagamento { id: string; tipo: string; valor: number; desconto_aplicado: number; status: string; forma: string; pago_em: string | null; created_at: string; observacao: string | null }

type Aba = 'pagando' | 'producao' | 'instaladas' | 'canceladas' | 'espera' | 'config'
const ABAS: { id: Aba; label: string }[] = [
  { id: 'pagando', label: 'Pagando' },
  { id: 'producao', label: 'Fila de produção' },
  { id: 'instaladas', label: 'Instaladas' },
  { id: 'canceladas', label: 'Canceladas' },
  { id: 'espera', label: 'Lista de espera' },
  { id: 'config', label: 'Configurações' },
]

const BADGE: Record<StatusAdesao, string> = {
  aguardando_pagamento: 'badge-draft', ativa: 'badge-sent', pausada: 'badge-expired', quitada: 'badge-ready',
  medicao_agendada: 'badge-prod', em_producao: 'badge-prod', instalacao_agendada: 'badge-prod', instalada: 'badge-ok', cancelada: 'badge-rejected',
}

const PROXIMA_ETAPA: Partial<Record<StatusAdesao, { status: StatusAdesao; label: string; pedeData?: boolean }>> = {
  quitada: { status: 'medicao_agendada', label: 'Agendar medição', pedeData: true },
  medicao_agendada: { status: 'em_producao', label: 'Medição feita, iniciar produção' },
  em_producao: { status: 'instalacao_agendada', label: 'Agendar instalação', pedeData: true },
  instalacao_agendada: { status: 'instalada', label: 'Marcar como instalada', pedeData: true },
}

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Erro')
  return j
}

function wa(numero: string) { return `https://wa.me/55${numero}` }

function DetalheModal({ adesao, config, onFechar, onMudou }: { adesao: Adesao; config: Config; onFechar: () => void; onMudou: () => void }) {
  const { toast } = useApp()
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [salvando, setSalvando] = useState(false)
  const [baixa, setBaixa] = useState({ valor: String(adesao.valor_parcela), forma: 'pix', data: hojeSP() })
  const [oferta, setOferta] = useState({ valor: adesao.oferta_quitacao_valor ? String(adesao.oferta_quitacao_valor) : '', validade: adesao.oferta_validade ?? '', mensagem: adesao.oferta_mensagem ?? '' })
  const [dataEtapa, setDataEtapa] = useState(hojeSP())
  const [novoPin, setNovoPin] = useState('')
  const r = resumoAdesao(adesao, config.prazo_entrega_dias)
  const pagando = STATUS_PAGANDO.includes(adesao.status)
  const prox = PROXIMA_ETAPA[adesao.status]

  const carregar = useCallback(async () => {
    try { setPagamentos((await api(`/api/programado/${adesao.id}`)).pagamentos) } catch { /* mostra vazio */ }
  }, [adesao.id])
  useEffect(() => { carregar() }, [carregar])

  async function acao(fn: () => Promise<unknown>, ok: string) {
    setSalvando(true)
    try { await fn(); toast(ok); await carregar(); onMudou() } catch (e) { toast(e instanceof Error ? e.message : 'Erro', 'err') } finally { setSalvando(false) }
  }

  const status = (s: StatusAdesao, data?: string) => acao(() => api(`/api/programado/${adesao.id}`, { method: 'PATCH', body: JSON.stringify({ acao: 'status', status: s, data }) }), 'Plano atualizado')

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div className="modal-title">#{adesao.numero} {adesao.nome}</div>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row-2" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div><strong>{adesao.kit_nome}</strong> · <span className={`badge ${BADGE[adesao.status]}`}>{STATUS_LABEL[adesao.status]}</span></div>
              <div>CPF {fmtCpf(adesao.cpf)}</div>
              <div><a href={wa(adesao.whatsapp)} target="_blank" rel="noopener noreferrer">{fmtFone(adesao.whatsapp)}</a>{adesao.email ? ` · ${adesao.email}` : ''}</div>
              <div>{[adesao.endereco, adesao.numero_endereco, adesao.complemento, adesao.bairro].filter(Boolean).join(', ')} — {adesao.cidade}</div>
              {adesao.utm_campaign && <div style={{ color: 'var(--text-muted)' }}>Origem: {adesao.utm_source} / {adesao.utm_campaign}</div>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>Pago: <strong>{fmtReais(r.pago, true)}</strong> de {fmtReais(adesao.valor_total)} ({r.progresso}%)</div>
              {adesao.desconto > 0 && <div>Desconto concedido: {fmtReais(adesao.desconto, true)}</div>}
              <div>Saldo: <strong>{fmtReais(r.saldo, true)}</strong></div>
              <div>Parcela {fmtReais(adesao.valor_parcela)} todo dia {adesao.dia_vencimento} · {r.parcelasPagas}/{r.parcelasTotal} pagas</div>
              {r.proximaParcelaVencimento && <div style={r.atrasada ? { color: 'var(--red)', fontWeight: 600 } : undefined}>Próx. vencimento: {fmtData(r.proximaParcelaVencimento)}{r.atrasada ? ' (atrasada)' : ''}</div>}
              {r.previsaoQuitacao && <div>Previsão de quitação: {fmtMesAno(r.previsaoQuitacao)}</div>}
              {adesao.antecipacao_solicitada_em && pagando && <div style={{ color: 'var(--gold)', fontWeight: 600 }}>Pediu antecipação em {fmtData(adesao.antecipacao_solicitada_em)}</div>}
            </div>
          </div>

          {prox && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Andamento da obra</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {prox.pedeData && <input className="form-input" style={{ width: 170 }} type="date" value={dataEtapa} onChange={e => setDataEtapa(e.target.value)} />}
                <button className="btn btn-primary" disabled={salvando} onClick={() => status(prox.status, prox.pedeData ? dataEtapa : undefined)}>{prox.label}</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>O cliente vê cada etapa no painel dele.</div>
            </div>
          )}

          {pagando && (
            <div className="form-row-2" style={{ marginBottom: 16, alignItems: 'start' }}>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Registrar pagamento recebido</div>
                <div className="form-row-2">
                  <div className="form-group"><label className="form-label">VALOR (R$)</label>
                    <input className="form-input" type="number" step="0.01" value={baixa.valor} onChange={e => setBaixa(b => ({ ...b, valor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">DATA</label>
                    <input className="form-input" type="date" value={baixa.data} onChange={e => setBaixa(b => ({ ...b, data: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label className="form-label">FORMA</label>
                  <select className="form-select" value={baixa.forma} onChange={e => setBaixa(b => ({ ...b, forma: e.target.value }))}>
                    <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
                  </select></div>
                <button className="btn btn-primary btn-sm" disabled={salvando}
                  onClick={() => acao(() => api(`/api/programado/${adesao.id}/pagamentos`, { method: 'POST', body: JSON.stringify(baixa) }), 'Pagamento registrado')}>
                  Registrar
                </button>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Oferta de quitação</div>
                <div className="form-row-2">
                  <div className="form-group"><label className="form-label">QUITAR POR (R$)</label>
                    <input className="form-input" type="number" step="0.01" placeholder={`saldo ${r.saldo.toFixed(2)}`} value={oferta.valor} onChange={e => setOferta(o => ({ ...o, valor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">VÁLIDA ATÉ</label>
                    <input className="form-input" type="date" value={oferta.validade} onChange={e => setOferta(o => ({ ...o, validade: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label className="form-label">MENSAGEM (OPCIONAL)</label>
                  <input className="form-input" maxLength={200} value={oferta.mensagem} onChange={e => setOferta(o => ({ ...o, mensagem: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={salvando}
                    onClick={() => acao(() => api(`/api/programado/${adesao.id}`, { method: 'PATCH', body: JSON.stringify({ acao: 'oferta', ...oferta }) }), 'Oferta salva')}>Salvar oferta</button>
                  {adesao.oferta_quitacao_valor != null && (
                    <button className="btn btn-ghost btn-sm" disabled={salvando}
                      onClick={() => { setOferta({ valor: '', validade: '', mensagem: '' }); acao(() => api(`/api/programado/${adesao.id}`, { method: 'PATCH', body: JSON.stringify({ acao: 'oferta', valor: null }) }), 'Oferta removida') }}>Remover</button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ fontWeight: 600, marginBottom: 6 }}>Pagamentos</div>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Forma</th><th className="text-right">Valor</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {pagamentos.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><p>Nenhum pagamento ainda.</p></div></td></tr>
                ) : pagamentos.map(p => (
                  <tr key={p.id}>
                    <td>{fmtData(p.pago_em ?? p.created_at)}</td>
                    <td>{p.tipo}{p.desconto_aplicado > 0 ? ` (−${fmtReais(p.desconto_aplicado)})` : ''}</td>
                    <td>{p.forma}</td>
                    <td className="text-right">{fmtReais(Number(p.valor), true)}</td>
                    <td><span className={`badge ${p.status === 'pago' ? 'badge-ok' : p.status === 'pendente' ? 'badge-sent' : 'badge-draft'}`}>{p.status}</span></td>
                    <td>{p.status === 'pendente' && pagando && (
                      <button className="btn btn-outline btn-sm" disabled={salvando}
                        onClick={() => acao(() => api(`/api/programado/${adesao.id}/pagamentos`, { method: 'POST', body: JSON.stringify({ pagamento_id: p.id, forma: 'pix', data: hojeSP() }) }), 'Recebimento confirmado')}>
                        Confirmar recebimento
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {novoPin && (
            <div className="card" style={{ padding: 14, marginBottom: 12, borderColor: 'var(--gold)' }}>
              Novo PIN: <strong style={{ fontSize: 20, letterSpacing: 4 }}>{novoPin}</strong>. Envie para o cliente pelo WhatsApp; ele não aparece de novo.
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {adesao.status === 'ativa' && <button className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => status('pausada')}>Pausar plano</button>}
            {adesao.status === 'pausada' && <button className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => status('ativa')}>Retomar plano</button>}
            <button className="btn btn-ghost btn-sm" disabled={salvando}
              onClick={() => acao(async () => { const j = await api(`/api/programado/${adesao.id}`, { method: 'PATCH', body: JSON.stringify({ acao: 'novo_pin' }) }); setNovoPin(j.pin) }, 'PIN redefinido')}>
              Gerar novo PIN
            </button>
          </div>
          {adesao.status !== 'instalada' && adesao.status !== 'cancelada' && (
            <button className="btn btn-danger btn-sm" disabled={salvando}
              onClick={() => { if (window.confirm(`Cancelar o plano #${adesao.numero}? A devolução do valor pago (${fmtReais(r.pago, true)}) deve ser feita à parte.`)) status('cancelada') }}>
              Cancelar plano
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigAba({ dados, onSalvo }: { dados: Dados; onSalvo: () => void }) {
  const { toast } = useApp()
  const [c, setC] = useState({
    ...dados.config,
    cidadesTxt: dados.config.cidades_atendidas.join('\n'),
    parcelasTxt: dados.config.parcelas_opcoes.join(', '),
    whatsapp_contato: dados.config.whatsapp_contato ?? '', pix_chave: dados.config.pix_chave ?? '', pix_favorecido: dados.config.pix_favorecido ?? '',
  })
  const [kits, setKits] = useState(dados.kits.map(k => ({ ...k, preco_total: Number(k.preco_total), custo_base: Number(k.custo_base) })))
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await api('/api/programado/config', {
        method: 'PUT', body: JSON.stringify({
          ativo: c.ativo, prazo_entrega_dias: Number(c.prazo_entrega_dias),
          cidades_atendidas: c.cidadesTxt.split('\n'), parcelas_opcoes: c.parcelasTxt.split(/[,;\s]+/).filter(Boolean).map(Number),
          whatsapp_contato: c.whatsapp_contato, pix_chave: c.pix_chave, pix_favorecido: c.pix_favorecido, kits,
        }),
      })
      toast('Configurações salvas'); onSalvo()
    } catch (e) { toast(e instanceof Error ? e.message : 'Erro', 'err') } finally { setSalvando(false) }
  }

  return (
    <div className="form-row-2" style={{ alignItems: 'start' }}>
      <div className="card"><div className="card-body">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={c.ativo} onChange={e => setC({ ...c, ativo: e.target.checked })} /> Aceitando novas adesões
        </label>
        <div className="form-group"><label className="form-label">PRAZO DE ENTREGA APÓS QUITAR (DIAS)</label>
          <input className="form-input" type="number" value={c.prazo_entrega_dias} onChange={e => setC({ ...c, prazo_entrega_dias: Number(e.target.value) })} /></div>
        <div className="form-group"><label className="form-label">OPÇÕES DE PARCELA (R$, SEPARADAS POR VÍRGULA)</label>
          <input className="form-input" value={c.parcelasTxt} onChange={e => setC({ ...c, parcelasTxt: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">CIDADES ATENDIDAS (UMA POR LINHA)</label>
          <textarea className="form-input" rows={8} value={c.cidadesTxt} onChange={e => setC({ ...c, cidadesTxt: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">WHATSAPP DE ATENDIMENTO</label>
          <input className="form-input" value={c.whatsapp_contato} onChange={e => setC({ ...c, whatsapp_contato: e.target.value })} /></div>
        <div className="form-row-2">
          <div className="form-group"><label className="form-label">CHAVE PIX (MODO MANUAL)</label>
            <input className="form-input" value={c.pix_chave} onChange={e => setC({ ...c, pix_chave: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">FAVORECIDO</label>
            <input className="form-input" value={c.pix_favorecido} onChange={e => setC({ ...c, pix_favorecido: e.target.value })} /></div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {dados.asaas ? 'Asaas conectado: o cliente recebe QR Code e a baixa é automática.' : 'Asaas ainda não conectado: o cliente vê a chave Pix acima e você confirma o recebimento aqui.'}
        </div>
      </div></div>
      <div className="card"><div className="card-body">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Kits</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Mudar o preço vale só para novas adesões. Ao cliente pagar o custo, o painel libera o pedido de antecipação.</div>
        {kits.map((k, i) => (
          <div key={k.id} style={{ borderTop: i ? '1px solid var(--divider)' : 0, paddingTop: i ? 12 : 0, marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, marginBottom: 6 }}>
              <input type="checkbox" checked={k.ativo} onChange={e => setKits(ks => ks.map(x => x.id === k.id ? { ...x, ativo: e.target.checked } : x))} />
              {k.nome} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({k.grupo === 'alto' ? 'alto' : 'médio'} padrão)</span>
            </label>
            <div className="form-row-2">
              <div className="form-group"><label className="form-label">PREÇO (R$)</label>
                <input className="form-input" type="number" value={k.preco_total} onChange={e => setKits(ks => ks.map(x => x.id === k.id ? { ...x, preco_total: Number(e.target.value) } : x))} /></div>
              <div className="form-group"><label className="form-label">CUSTO (R$)</label>
                <input className="form-input" type="number" value={k.custo_base} onChange={e => setKits(ks => ks.map(x => x.id === k.id ? { ...x, custo_base: Number(e.target.value) } : x))} /></div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Margem bruta: {fmtReais(k.preco_total - k.custo_base)} ({k.preco_total ? Math.round((1 - k.custo_base / k.preco_total) * 100) : 0}%)</div>
          </div>
        ))}
        <button className="btn btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar configurações'}</button>
      </div></div>
    </div>
  )
}

export default function ProgramadoPage() {
  const { toast } = useApp()
  const [dados, setDados] = useState<Dados | null>(null)
  const [aba, setAba] = useState<Aba>('pagando')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try { setDados(await api('/api/programado')) } catch (e) { toast(e instanceof Error ? e.message : 'Erro ao carregar', 'err') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])

  const prazo = dados?.config.prazo_entrega_dias ?? 20
  const comResumo = useMemo(() => (dados?.adesoes ?? []).map(a => ({ a, r: resumoAdesao(a, prazo) })), [dados, prazo])

  const stats = useMemo(() => {
    const pagando = comResumo.filter(x => STATUS_PAGANDO.includes(x.a.status))
    const naFila = comResumo.filter(x => STATUS_NA_FILA.includes(x.a.status))
    const guardado = [...pagando, ...naFila].reduce((s, x) => s + Number(x.a.total_pago), 0)
    const atrasadas = pagando.filter(x => x.r.atrasada).length
    const antecipar = pagando.filter(x => x.a.antecipacao_solicitada_em).length
    // Previsão de quitação por mês (próximos 6), para planejar compra de chapa.
    const meses = new Map<string, Map<string, number>>()
    pagando.forEach(x => {
      if (!x.r.previsaoQuitacao) return
      const m = x.r.previsaoQuitacao.slice(0, 7)
      if (!meses.has(m)) meses.set(m, new Map())
      const mm = meses.get(m)!
      mm.set(x.a.kit_nome, (mm.get(x.a.kit_nome) ?? 0) + 1)
    })
    const previsao = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6)
    return { pagando: pagando.length, naFila: naFila.length, guardado, atrasadas, antecipar, previsao }
  }, [comResumo])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return comResumo.filter(({ a }) => {
      const okAba = aba === 'pagando' ? STATUS_PAGANDO.includes(a.status)
        : aba === 'producao' ? STATUS_NA_FILA.includes(a.status)
        : aba === 'instaladas' ? a.status === 'instalada'
        : aba === 'canceladas' ? a.status === 'cancelada' : false
      if (!okAba) return false
      if (!q) return true
      return a.nome.toLowerCase().includes(q) || a.cpf.includes(q.replace(/\D/g, '') || '#') || String(a.numero) === q || a.cidade.toLowerCase().includes(q)
    }).sort((x, y) => aba === 'producao'
      ? (x.a.quitada_em ?? '').localeCompare(y.a.quitada_em ?? '')
      : Number(y.r.atrasada) - Number(x.r.atrasada) || y.r.progresso - x.r.progresso)
  }, [comResumo, aba, busca])

  const adesaoAberta = dados?.adesoes.find(a => a.id === aberta) ?? null

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Pia Programada</h1>
        <a className="btn btn-outline" href="/minha-pia" target="_blank" rel="noopener noreferrer">Ver página do cliente</a>
      </div>

      {!dados ? <div className="empty-state"><p>Carregando…</p></div> : (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card"><div className="stat-label">Planos pagando</div><div className="stat-value">{stats.pagando}</div>
              {stats.atrasadas > 0 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{stats.atrasadas} com parcela atrasada</div>}</div>
            <div className="stat-card"><div className="stat-label">Valor guardado dos clientes</div><div className="stat-value">{fmtReais(stats.guardado)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ainda não é receita: pias não entregues</div></div>
            <div className="stat-card"><div className="stat-label">Na fila de produção</div><div className="stat-value">{stats.naFila}</div></div>
            <div className="stat-card"><div className="stat-label">Pedidos de antecipação</div><div className="stat-value" style={stats.antecipar ? { color: 'var(--gold)' } : undefined}>{stats.antecipar}</div></div>
          </div>

          {stats.previsao.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div className="card-title">Previsão de pias quitadas por mês</div></div>
              <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                {stats.previsao.map(([mes, kits]) => (
                  <div key={mes}>
                    <div style={{ fontWeight: 600 }}>{fmtMesAno(mes + '-01')}: {[...kits.values()].reduce((s, n) => s + n, 0)}</div>
                    {[...kits.entries()].map(([k, n]) => <div key={k} style={{ color: 'var(--text-muted)' }}>{n}× {k}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tabs" style={{ marginBottom: 16 }}>
            {ABAS.map(a => <button key={a.id} className={`tab${aba === a.id ? ' active' : ''}`} onClick={() => setAba(a.id)}>{a.label}{a.id === 'espera' ? ` (${dados.lista_espera.length})` : ''}</button>)}
          </div>

          {aba === 'config' ? <ConfigAba dados={dados} onSalvo={carregar} /> : aba === 'espera' ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Nome</th><th>Cidade</th><th>WhatsApp</th><th>Pia</th></tr></thead>
                <tbody>
                  {dados.lista_espera.length === 0 ? <tr><td colSpan={5}><div className="empty-state"><p>Ninguém na lista de espera.</p></div></td></tr>
                    : dados.lista_espera.map(e => (
                      <tr key={e.id}><td>{fmtData(e.created_at)}</td><td>{e.nome}</td><td>{e.cidade}</td>
                        <td><a href={wa(e.whatsapp)} target="_blank" rel="noopener noreferrer">{fmtFone(e.whatsapp)}</a></td><td>{e.kit_codigo ?? '—'}</td></tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <input className="form-input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder="Buscar por nome, CPF, nº ou cidade" value={busca} onChange={e => setBusca(e.target.value)} />
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Nº</th><th>Cliente</th><th>Pia</th><th>Cidade</th>
                    <th className="text-right">Pago</th><th>Progresso</th>
                    <th>{aba === 'producao' ? 'Quitada em' : aba === 'instaladas' ? 'Instalada em' : 'Próx. vencimento'}</th><th>Situação</th>
                  </tr></thead>
                  <tbody>
                    {lista.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><p>Nenhum plano aqui.</p></div></td></tr>
                      : lista.map(({ a, r }) => (
                        <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setAberta(a.id)}>
                          <td>#{a.numero}</td>
                          <td>{a.nome}{a.antecipacao_solicitada_em && STATUS_PAGANDO.includes(a.status) ? <span className="badge badge-pro" style={{ marginLeft: 6 }}>quer antecipar</span> : null}</td>
                          <td>{a.kit_nome}</td>
                          <td>{a.cidade}</td>
                          <td className="text-right">{fmtReais(Number(a.total_pago))}</td>
                          <td style={{ minWidth: 110 }}>
                            <div style={{ height: 6, background: 'var(--divider)', borderRadius: 3 }}>
                              <div style={{ width: `${r.progresso}%`, height: 6, background: r.progresso >= 100 ? 'var(--green)' : 'var(--gold)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.progresso}%</span>
                          </td>
                          <td style={aba === 'pagando' && r.atrasada ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
                            {aba === 'producao' ? fmtData(a.quitada_em) : aba === 'instaladas' ? fmtData(a.instalada_em) : fmtData(r.proximaParcelaVencimento)}
                          </td>
                          <td><span className={`badge ${BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {adesaoAberta && dados && (
        <DetalheModal key={adesaoAberta.id + adesaoAberta.status + adesaoAberta.total_pago} adesao={adesaoAberta} config={dados.config} onFechar={() => setAberta(null)} onMudou={carregar} />
      )}
    </div>
  )
}

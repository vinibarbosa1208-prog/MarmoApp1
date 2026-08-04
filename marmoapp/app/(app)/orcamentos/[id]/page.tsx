'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import { fmt, orcTotal, areaCortadaItens, mlAcabamentoItens, taxaMediaPorCargo } from '@/lib/utils'
import type { OrcamentoItem } from '@/lib/types'
import type { OrcamentoPDF, ItemPDF } from '@/lib/pdf/gerar-orcamento-pdf'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
}
const STATUS_CLASS: Record<string, string> = {
  rascunho: 'badge-draft', enviado: 'badge-sent', aprovado: 'badge-approved', recusado: 'badge-rejected',
}
const ETAPA_LABEL: Record<string, { label: string; cor: string }> = {
  comercial:         { label: 'Comercial',              cor: '#2980B9' },
  corte:             { label: 'Corte',                  cor: '#8E44AD' },
  acabamento:        { label: 'Acabamento',              cor: '#E67E22' },
  aguardando_data:   { label: 'Aguardando Data',         cor: '#16A085' },
  instalacao:        { label: 'Instalação Confirmada',   cor: '#27AE60' },
  finalizado:        { label: 'Finalizado',              cor: '#2C3E50' },
}

interface InstalacaoRegistrada {
  id: string
  data: string
  metros_lineares: number
  valor_total: number | null
  funcionarios: { nome: string } | null
}

interface ProjetoLink { id: string; titulo: string | null; nome_centro: string | null }
interface FuncionarioTaxa { id: string; nome: string; cargo: string; ativo: boolean; valor_metro_linear: number | null }

export default function VerOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const orcId = params.id as string
  const { orcamentos, clientes, marmoraria, toast, loadOrcamentos } = useApp()
  const [itens, setItens] = useState<OrcamentoItem[]>([])
  const [loadingItens, setLoadingItens] = useState(true)
  const [instalacoes, setInstalacoes] = useState<InstalacaoRegistrada[]>([])
  const [projeto, setProjeto] = useState<ProjetoLink | null>(null)
  const [funcionarios, setFuncionarios] = useState<FuncionarioTaxa[]>([])
  const [descontoSimulado, setDescontoSimulado] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orc = orcamentos.find(o => o.id === orcId)
  const cliente = clientes.find(c => c.id === (orc?.cliente_id || orc?.clienteId)) || null

  useEffect(() => {
    supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcId).then(({ data }) => {
      if (data) setItens(data)
      setLoadingItens(false)
    })
    // Instalações efetivamente registradas (data real de execução) e o
    // Centro de Custos vinculado a este orçamento, pro card de Produção.
    supabase.from('funcionario_instalacoes')
      .select('id, data, metros_lineares, valor_total, funcionarios(nome)')
      .eq('ordem_servico_id', orcId)
      .order('data', { ascending: false })
      .then(({ data }) => setInstalacoes((data as any) || []))
    supabase.from('projetos')
      .select('id, titulo, nome_centro')
      .eq('orcamento_id', orcId)
      .maybeSingle()
      .then(({ data }) => setProjeto(data))
    fetch('/api/funcionarios', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: FuncionarioTaxa[]) => setFuncionarios(data || []))
  }, [orcId])

  const buildOrcPDF = useCallback((): OrcamentoPDF | null => {
    if (!orc) return null
    return {
      id: orc.id,
      numero: orc.numero,
      descricao: orc.descricao,
      status: orc.status,
      mao_obra: orc.mao_obra || orc.maoObra || 0,
      desconto_rs: orc.desconto_rs || orc.desconto || 0,
      total: orc.total || orcTotal(orc),
      observacoes: orc.observacoes,
      validade: orc.validade,
      created_at: orc.created_at,
      tem_variantes: orc.tem_variantes,
      total_variante_a: orc.total_variante_a,
      total_variante_b: orc.total_variante_b,
      total_variante_c: orc.total_variante_c,
      nome_variante_a: orc.nome_variante_a,
      nome_variante_b: orc.nome_variante_b,
      nome_variante_c: orc.nome_variante_c,
      itens: itens.map((i): ItemPDF => ({
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        total_item: i.total_item || i.total || i.preco_unitario * i.quantidade,
        largura: i.largura,
        altura: i.altura,
        area: i.area,
        tipo_peca: i.tipo_peca,
        acabamento_esquerda: i.acabamento_esquerda,
        acabamento_direita: i.acabamento_direita,
        acabamento_frente: i.acabamento_frente,
        acabamento_fundo: i.acabamento_fundo,
        tem_saia: i.tem_saia,
        altura_saia: i.altura_saia,
        tem_frontao: i.tem_frontao,
        altura_frontao: i.altura_frontao,
        dados_extras: i.dados_extras ?? undefined,
        variante: i.variante ?? undefined,
        nome_variante: i.nome_variante ?? undefined,
      })),
    }
  }, [orc, itens])

  async function gerarDoc() {
    if (!marmoraria) { toast('Dados da empresa não disponíveis', 'err'); return null }
    const orcPDF = buildOrcPDF()
    if (!orcPDF) return null
    setGeneratingPdf(true)
    try {
      const { data: marmFresh } = await supabase
        .from('marmorarias')
        .select('*')
        .eq('id', marmoraria.id)
        .single()
      const { gerarOrcamentoPDF } = await import('@/lib/pdf/gerar-orcamento-pdf')
      return await gerarOrcamentoPDF(orcPDF, marmFresh ?? marmoraria, cliente)
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function baixarPDF() {
    const doc = await gerarDoc()
    if (!doc || !orc) return
    const year = new Date(orc.created_at).getFullYear()
    const num = String(orc.numero ?? 0).padStart(4, '0')
    doc.save(`ORC-${year}-${num}.pdf`)
    toast('PDF baixado!', 'ok2')
  }

  async function visualizarPDF() {
    const doc = await gerarDoc()
    if (!doc) return
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  async function excluirOrcamento() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/orcamentos/${orcId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      toast('Orçamento excluído', 'ok2')
      await loadOrcamentos()
      router.push('/orcamentos')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'err')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  function enviarWhatsApp() {
    if (!orc) return
    const nome = cliente?.nome?.split(' ')[0] || 'cliente'
    const total = orc.total || orcTotal(orc)
    let msg = `Olá ${nome}! 😊\n\nSegue seu orçamento!\n\n`
    if (orc.descricao) msg += `📋 ${orc.descricao}\n`
    msg += `💰 Total: ${fmt(total)}\n`
    if (orc.validade) msg += `📅 Válido até: ${new Date(orc.validade).toLocaleDateString('pt-BR')}\n`
    msg += '\nQualquer dúvida, estamos à disposição!'
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const wa = `https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(msg)}`
    window.open(wa, '_blank')
  }

  if (!orc && !loadingItens) return (
    <div className="page-inner">
      <p style={{ color: 'var(--gray)' }}>Orçamento não encontrado. <Link href="/orcamentos">Voltar à lista</Link></p>
    </div>
  )

  if (!orc) return <div className="page-inner"><p>Carregando...</p></div>

  const subtotal = itens.reduce((s, i) => s + (i.total_item || i.total || i.preco_unitario * i.quantidade), 0)
  const maoObra = orc.mao_obra || orc.maoObra || 0
  const desconto = orc.desconto_rs || orc.desconto || 0
  const totalFinal = loadingItens ? (orc.total || orcTotal(orc)) : subtotal + maoObra - desconto
  const year = new Date(orc.created_at).getFullYear()
  const num = String(orc.numero ?? 0).padStart(4, '0')
  const orcNumStr = `ORC-${year}-${num}`
  const busy = generatingPdf || loadingItens

  // Margem estimada com custo real (taxa dos funcionários), não com o preço
  // de venda como proxy — funciona mesmo antes do orçamento fechar, pra
  // decidir desconto com segurança.
  const materiaisItens = itens.filter(i => i.tipo === 'material')
  const custoMaterial = materiaisItens.reduce((s, i) => s + (i.custo_item || 0), 0)
  const areaTotal = areaCortadaItens(itens)
  const mlAcabamentoTotal = mlAcabamentoItens(itens)
  const taxaCorte = taxaMediaPorCargo(funcionarios, 'serrador')
  const taxaAcabamento = taxaMediaPorCargo(funcionarios, 'acabador')
  const taxaInstalacao = taxaMediaPorCargo(funcionarios, 'instalador')
  const custoCorte = areaTotal * taxaCorte
  const custoAcabamento = mlAcabamentoTotal * taxaAcabamento
  // Aproximação: assume que os metros lineares de acabamento ≈ metros
  // lineares instalados (mesma borda que é acabada costuma ser a instalada)
  const custoInstalacaoEstimado = mlAcabamentoTotal * taxaInstalacao
  const custoTotalEstimado = custoMaterial + custoCorte + custoAcabamento + custoInstalacaoEstimado
  const temTaxasCadastradas = taxaCorte > 0 || taxaAcabamento > 0 || taxaInstalacao > 0

  const descontoSimuladoNum = parseFloat(descontoSimulado) || 0
  const valorComDesconto = Math.max(0, totalFinal - descontoSimuladoNum)
  const margemBase = totalFinal - custoTotalEstimado
  const margemBasePct = totalFinal > 0 ? (margemBase / totalFinal) * 100 : 0
  const margemComDesconto = valorComDesconto - custoTotalEstimado
  const margemComDescontoPct = valorComDesconto > 0 ? (margemComDesconto / valorComDesconto) * 100 : 0

  function corMargem(pct: number): string {
    if (pct >= 30) return 'var(--green)'
    if (pct >= 10) return '#E67E22'
    return 'var(--red)'
  }

  return (
    <div className="page-inner">
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 12px', fontFamily: "'Playfair Display', serif", fontSize: 20 }}>Excluir orçamento</h3>
            <p style={{ color: 'var(--gray)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Tem certeza que deseja excluir o orçamento <strong>{orcNumStr}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancelar</button>
              <button
                className="btn"
                onClick={excluirOrcamento}
                disabled={deleting}
                style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">{orcNumStr}</h1>
          {orc.descricao && <p style={{ color: 'var(--gray)', margin: '4px 0 0', fontSize: 14 }}>{orc.descricao}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => router.push('/orcamentos')}>← Voltar</button>
          <button className="btn btn-outline" onClick={enviarWhatsApp}>📲 WhatsApp</button>
          <button
            className="btn btn-outline"
            onClick={() => setShowDeleteModal(true)}
            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
          >🗑️ Excluir</button>
          <button className="btn btn-outline" onClick={visualizarPDF} disabled={busy}>
            {generatingPdf ? 'Gerando...' : '👁️ Ver PDF'}
          </button>
          <button className="btn btn-gold" onClick={baixarPDF} disabled={busy}>
            {generatingPdf ? 'Gerando...' : '⬇️ Baixar PDF'}
          </button>
          <Link href={`/orcamentos/${orcId}/editar`} className="btn btn-outline">✏️ Editar</Link>
        </div>
      </div>

      <div className="orcamento-view-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Informações</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Cliente</div>
                  {cliente ? (
                    <Link href={`/clientes/${cliente.id}`} style={{ fontWeight: 600, color: 'var(--dark)', textDecoration: 'none' }}>{cliente.nome} →</Link>
                  ) : (
                    <div style={{ fontWeight: 600 }}>—</div>
                  )}
                  {cliente?.telefone && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{cliente.telefone}</div>}
                  {cliente?.email && <div style={{ fontSize: 13, color: 'var(--gray)' }}>{cliente.email}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                  <span className={`badge ${STATUS_CLASS[orc.status] || 'badge-draft'}`}>{STATUS_LABEL[orc.status] || orc.status}</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Emissão</div>
                  <div style={{ fontSize: 14 }}>{new Date(orc.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                {orc.validade && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Válido até</div>
                    <div style={{ fontSize: 14 }}>{new Date(orc.validade).toLocaleDateString('pt-BR')}</div>
                  </div>
                )}
              </div>
              {orc.observacoes && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Observações</div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--dark)' }}>{orc.observacoes}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Itens do Orçamento</span></div>
            <div className="table-wrap">
              {loadingItens ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray)' }}>Carregando itens...</div>
              ) : itens.length === 0 ? (
                <div className="empty-state"><p>Nenhum item neste orçamento</p></div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className="badge badge-draft">{item.tipo}</span></td>
                        <td style={{ fontWeight: 500 }}>{item.descricao}</td>
                        <td>{item.quantidade}</td>
                        <td>{fmt(item.preco_unitario)}</td>
                        <td className="font-bold">{fmt(item.total_item || item.total || item.preco_unitario * item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {!loadingItens && itens.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">💰 Margem Estimada</span></div>
              <div className="card-body">
                {!temTaxasCadastradas && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--light)', padding: 10, borderRadius: 6, marginBottom: 14 }}>
                    Cadastre a taxa de custo (R$/m² ou R$/ml) dos serradores, acabadores e instaladores em <b>Funcionários</b> pra essa margem considerar mão de obra e instalação — por enquanto só o custo de material está sendo calculado.
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Material</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(custoMaterial)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Corte {taxaCorte === 0 && '(sem taxa)'}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(custoCorte)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Acabamento {taxaAcabamento === 0 && '(sem taxa)'}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(custoAcabamento)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Instalação (estim.) {taxaInstalacao === 0 && '(sem taxa)'}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(custoInstalacaoEstimado)}</div>
                  </div>
                </div>

                {materiaisItens.length > 0 && (
                  <details style={{ marginBottom: 16, fontSize: 12 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--gray)', fontWeight: 600 }}>Ver materiais considerados ({materiaisItens.length})</summary>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {materiaisItens.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{i.descricao}</span>
                          <span style={{ color: 'var(--gray)' }}>{fmt(i.custo_item || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Custo total estimado</span>
                    <strong>{fmt(custoTotalEstimado)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Valor do orçamento</span>
                    <strong>{fmt(totalFinal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 8 }}>
                    <span style={{ fontWeight: 700 }}>Margem</span>
                    <strong style={{ color: corMargem(margemBasePct) }}>{fmt(margemBase)} ({margemBasePct.toFixed(1)}%)</strong>
                  </div>
                </div>

                <div style={{ background: 'var(--light)', borderRadius: 8, padding: 12 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Simular desconto (R$)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={descontoSimulado}
                    onChange={e => setDescontoSimulado(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  {descontoSimuladoNum > 0 && (
                    <div style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Valor com desconto</span>
                        <strong>{fmt(valorComDesconto)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Margem com desconto</span>
                        <strong style={{ color: corMargem(margemComDescontoPct) }}>
                          {fmt(margemComDesconto)} ({margemComDescontoPct.toFixed(1)}%)
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {orc.producao_status && (
            <div className="card">
              <div className="card-header"><span className="card-title">Produção</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Etapa Atual</div>
                    <span className="badge" style={{ background: ETAPA_LABEL[orc.producao_status]?.cor || 'var(--gray)', color: '#fff' }}>
                      {ETAPA_LABEL[orc.producao_status]?.label || orc.producao_status}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Instalação Prevista</div>
                    <div style={{ fontSize: 14 }}>
                      {(orc as any).data_prevista_instalacao
                        ? new Date((orc as any).data_prevista_instalacao + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: projeto ? 16 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 6 }}>Instalações Executadas</div>
                  {instalacoes.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Nenhuma instalação registrada ainda</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {instalacoes.map(i => (
                        <div key={i.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--divider)', paddingBottom: 6 }}>
                          <span>{new Date(i.data + 'T00:00:00').toLocaleDateString('pt-BR')} — {i.funcionarios?.nome || 'Instalador'}</span>
                          <span style={{ color: 'var(--gray)' }}>{i.metros_lineares} m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {projeto && (
                  <Link href={`/projetos/${projeto.id}`} className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
                    📊 Abrir Centro de Custos
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Resumo</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--gray)' }}>Subtotal itens</span>
                  <strong>{fmt(subtotal)}</strong>
                </div>
                {maoObra > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--gray)' }}>Mão de obra</span>
                    <strong>{fmt(maoObra)}</strong>
                  </div>
                )}
                {desconto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--gray)' }}>Desconto</span>
                    <strong style={{ color: 'var(--red)' }}>– {fmt(desconto)}</strong>
                  </div>
                )}
                <hr style={{ border: 'none', borderTop: '2px solid var(--gold)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                  <span>TOTAL</span>
                  <span style={{ color: 'var(--gold)' }}>{fmt(totalFinal)}</span>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-gold" style={{ width: '100%' }} onClick={baixarPDF} disabled={busy}>
                  {generatingPdf ? 'Gerando...' : '⬇️ Baixar PDF'}
                </button>
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={visualizarPDF} disabled={busy}>
                  {generatingPdf ? 'Gerando...' : '👁️ Visualizar PDF'}
                </button>
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={enviarWhatsApp}>
                  📲 Enviar WhatsApp
                </button>
                <Link href={`/orcamentos/${orcId}/editar`} className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
                  ✏️ Editar Orçamento
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

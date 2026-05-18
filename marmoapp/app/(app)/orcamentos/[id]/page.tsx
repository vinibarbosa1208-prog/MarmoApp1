'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import { fmt, orcTotal } from '@/lib/utils'
import type { OrcamentoItem } from '@/lib/types'
import type { OrcamentoPDF, ItemPDF } from '@/lib/pdf/gerar-orcamento-pdf'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
}
const STATUS_CLASS: Record<string, string> = {
  rascunho: 'badge-draft', enviado: 'badge-sent', aprovado: 'badge-approved', recusado: 'badge-rejected',
}

export default function VerOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const orcId = params.id as string
  const { orcamentos, clientes, marmoraria, toast } = useApp()
  const [itens, setItens] = useState<OrcamentoItem[]>([])
  const [loadingItens, setLoadingItens] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const orc = orcamentos.find(o => o.id === orcId)
  const cliente = clientes.find(c => c.id === (orc?.cliente_id || orc?.clienteId)) || null

  useEffect(() => {
    supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcId).then(({ data }) => {
      if (data) setItens(data)
      setLoadingItens(false)
    })
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
      itens: itens.map((i): ItemPDF => ({
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        total_item: i.total_item || i.total || i.preco_unitario * i.quantidade,
        largura: i.largura,
        altura: i.altura,
        area: i.area,
      })),
    }
  }, [orc, itens])

  async function gerarDoc() {
    if (!marmoraria) { toast('Dados da empresa não disponíveis', 'err'); return null }
    const orcPDF = buildOrcPDF()
    if (!orcPDF) return null
    setGeneratingPdf(true)
    try {
      const { gerarOrcamentoPDF } = await import('@/lib/pdf/gerar-orcamento-pdf')
      return gerarOrcamentoPDF(orcPDF, marmoraria, cliente)
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
  const totalFinal = orc.total || orcTotal(orc)
  const year = new Date(orc.created_at).getFullYear()
  const num = String(orc.numero ?? 0).padStart(4, '0')
  const orcNumStr = `ORC-${year}-${num}`
  const busy = generatingPdf || loadingItens

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">{orcNumStr}</h1>
          {orc.descricao && <p style={{ color: 'var(--gray)', margin: '4px 0 0', fontSize: 14 }}>{orc.descricao}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => router.push('/orcamentos')}>← Voltar</button>
          <button className="btn btn-outline" onClick={enviarWhatsApp}>📲 WhatsApp</button>
          <button className="btn btn-outline" onClick={visualizarPDF} disabled={busy}>
            {generatingPdf ? 'Gerando...' : '👁️ Ver PDF'}
          </button>
          <button className="btn btn-gold" onClick={baixarPDF} disabled={busy}>
            {generatingPdf ? 'Gerando...' : '⬇️ Baixar PDF'}
          </button>
          <Link href={`/orcamentos/${orcId}/editar`} className="btn btn-outline">✏️ Editar</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Informações</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Cliente</div>
                  <div style={{ fontWeight: 600 }}>{cliente?.nome || '—'}</div>
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
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #EDE9E2' }}>
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
                    <strong style={{ color: '#c0392b' }}>– {fmt(desconto)}</strong>
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

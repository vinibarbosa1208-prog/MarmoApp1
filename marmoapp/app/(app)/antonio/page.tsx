'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  orcamentoId?: string
}

function OrcamentoActions({ orcamentoId }: { orcamentoId: string }) {
  const { orcamentos, clientes, marmoraria, toast } = useApp()
  const [busy, setBusy] = useState(false)

  const orc = orcamentos.find(o => o.id === orcamentoId)
  const cliente = clientes.find(c => c.id === (orc?.cliente_id || orc?.clienteId)) || null

  async function baixarPDF() {
    if (!orc || !marmoraria) { toast('Dados não disponíveis', 'err'); return }
    setBusy(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: itensData } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcamentoId)
      const { gerarOrcamentoPDF } = await import('@/lib/pdf/gerar-orcamento-pdf')
      const doc = await gerarOrcamentoPDF({
        id: orc.id, numero: orc.numero, descricao: orc.descricao, status: orc.status,
        mao_obra: orc.mao_obra || orc.maoObra || 0, desconto_rs: orc.desconto_rs || orc.desconto || 0,
        total: orc.total || 0, observacoes: orc.observacoes, validade: orc.validade, created_at: orc.created_at,
        itens: (itensData || []).map(i => ({
          tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
          preco_unitario: i.preco_unitario, total_item: i.total_item || i.preco_unitario * i.quantidade,
          largura: i.largura, altura: i.altura, area: i.area,
        })),
      }, marmoraria, cliente)
      const year = new Date(orc.created_at).getFullYear()
      const num = String(orc.numero ?? 0).padStart(4, '0')
      doc.save(`ORC-${year}-${num}.pdf`)
      toast('PDF baixado!', 'ok2')
    } finally {
      setBusy(false)
    }
  }

  function enviarWhatsApp() {
    if (!orc) return
    const nome = cliente?.nome?.split(' ')[0] || 'cliente'
    let msg = `Olá ${nome}! 😊\n\nSegue seu orçamento!\n\n`
    if (orc.descricao) msg += `📋 ${orc.descricao}\n`
    if (orc.total) msg += `💰 Total: ${orc.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`
    msg += '\nQualquer dúvida, estamos à disposição!'
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <Link href={`/orcamentos/${orcamentoId}`} className="btn btn-gold" style={{ fontSize: 12, padding: '6px 14px' }}>
        📄 Ver Orçamento
      </Link>
      <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={baixarPDF} disabled={busy}>
        {busy ? '...' : '⬇️ Baixar PDF'}
      </button>
      <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={enviarWhatsApp}>
        📲 WhatsApp
      </button>
    </div>
  )
}

export default function AntonioPage() {
  const { marmoraria, clientes, materiais, servicos, toast } = useApp()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o Agente Antônio 👋\n\nPosso gerar orçamentos automaticamente a partir de uma descrição em texto ou áudio. Como posso ajudar?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (marmoraria?.plano !== 'enterprise') {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1 className="page-title">Agente Antônio</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 64 }}>🔒</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28 }}>Recurso Enterprise</h2>
          <p style={{ color: 'var(--gray)', maxWidth: 420 }}>
            O Agente Antônio está disponível apenas no Plano Enterprise.
            Faça upgrade para acessar geração automática de orçamentos por texto e áudio.
          </p>
          <button className="btn btn-gold" style={{ padding: '14px 32px', fontSize: 15 }}
            onClick={() => window.open('https://marmoapp.com/#planos', '_blank')}>
            Ver Plano Enterprise →
          </button>
        </div>
      </div>
    )
  }

  async function enviarMensagem() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/antonio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          marmoraria: { id: marmoraria!.id, nome: marmoraria!.nome },
          catalogo: { materiais, servicos, clientes },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na API')

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        orcamentoId: data.orcamentoId || undefined,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao conectar com o agente', 'err')
    } finally {
      setLoading(false)
    }
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await transcreverAudio(blob)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch {
      toast('Sem acesso ao microfone', 'err')
    }
  }

  function pararGravacao() {
    mediaRef.current?.stop()
    setRecording(false)
  }

  async function transcreverAudio(blob: Blob) {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'audio.webm')
      const res = await fetch('/api/antonio/audio', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInput(data.text)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro na transcrição', 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-inner" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), #E8C96A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🤖
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Agente Antônio</h1>
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
              Online · Plano Enterprise
            </div>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 16px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), #E8C96A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginRight: 10 }}>
                🤖
              </div>
            )}
            <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? 'var(--gold)' : '#fff',
                color: 'var(--dark)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14,
              }}>
                {msg.content}
              </div>
              {msg.orcamentoId && (
                <OrcamentoActions orcamentoId={msg.orcamentoId} />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), #E8C96A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '18px 18px 18px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 8, height: 8, background: 'var(--gold)', borderRadius: '50%', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ background: '#fff', borderTop: '1px solid #eee', padding: '16px 0 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <button
            onClick={recording ? pararGravacao : iniciarGravacao}
            disabled={loading}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: recording ? 'var(--red)' : '#f0f0f0',
              color: recording ? '#fff' : 'var(--gray)', fontSize: 18, flexShrink: 0,
              animation: recording ? 'pulse 1s infinite' : 'none',
            }}
            title={recording ? 'Parar gravação' : 'Gravar áudio'}
          >
            🎤
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
            placeholder="Descreva o orçamento... Ex: Bancada de granito preto 2m x 60cm com polimento"
            disabled={loading || recording}
            style={{
              flex: 1, padding: '12px 16px', border: '1.5px solid #e8e8e8', borderRadius: 12,
              fontSize: 14, fontFamily: 'DM Sans, sans-serif', resize: 'none', minHeight: 44, maxHeight: 120,
              outline: 'none', lineHeight: 1.5,
            }}
            rows={1}
          />
          <button
            className="btn btn-gold"
            onClick={enviarMensagem}
            disabled={loading || !input.trim()}
            style={{ height: 44, minWidth: 44, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
          >
            ➤
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gray)', textAlign: 'center' }}>
          Powered by Claude Sonnet · Enterprise only · Enter para enviar, Shift+Enter para nova linha
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
      `}</style>
    </div>
  )
}

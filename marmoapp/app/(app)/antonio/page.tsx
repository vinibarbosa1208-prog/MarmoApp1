'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'

const WELCOME = 'Olá! Sou o Antonio, seu especialista virtual em marmoraria. Posso criar orçamentos, consultar sua agenda, buscar informações de clientes e tirar dúvidas técnicas. Como posso te ajudar hoje?'

const QUICK_ACTIONS = [
  { label: '📋 Criar um orçamento', message: 'Quero criar um novo orçamento' },
  { label: '📅 Ver minha agenda', message: 'Quais são meus compromissos de hoje?' },
  { label: '👤 Consultar clientes', message: 'Quais clientes cadastrei recentemente?' },
  { label: '🔧 Dúvida técnica', message: 'Preciso de ajuda com uma dúvida técnica' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  orcamentoId?: string
}

interface Session {
  id: string
  firstMessage: string
  date: string
  messages: Message[]
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function Avatar({ size = 36 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--gold), #E8C96A)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.44, fontWeight: 700, color: '#2C2922',
      fontFamily: "'Playfair Display', serif", flexShrink: 0,
    }}>A</div>
  )
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
    } finally { setBusy(false) }
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
      <Link href={`/orcamentos/${orcamentoId}`} className="btn btn-gold" style={{ fontSize: 12, padding: '6px 14px' }}>📄 Ver Orçamento</Link>
      <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={baixarPDF} disabled={busy}>{busy ? '...' : '⬇️ Baixar PDF'}</button>
      <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={enviarWhatsApp}>📲 WhatsApp</button>
    </div>
  )
}

export default function AntonioPage() {
  const { marmoraria, clientes, materiais, servicos, toast } = useApp()
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState(() => genId())
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME, timestamp: new Date().toISOString() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('antonio_sessions')
      if (raw) setSessions(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function persistSession(msgs: Message[], sessionId: string) {
    const userMsgs = msgs.filter(m => m.role === 'user')
    if (userMsgs.length === 0) return
    const session: Session = {
      id: sessionId,
      firstMessage: userMsgs[0].content.slice(0, 60),
      date: new Date().toISOString(),
      messages: msgs,
    }
    setSessions(prev => {
      const updated = [session, ...prev.filter(s => s.id !== sessionId)].slice(0, 5)
      try { localStorage.setItem('antonio_sessions', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  function novaConversa() {
    setCurrentSessionId(genId())
    setMessages([{ role: 'assistant', content: WELCOME, timestamp: new Date().toISOString() }])
    setInput('')
  }

  function carregarSessao(s: Session) {
    setCurrentSessionId(s.id)
    setMessages(s.messages)
  }

  const enviarMensagem = useCallback(async (texto?: string) => {
    const content = (texto ?? input).trim()
    if (!content || loading || !marmoraria) return
    const userMsg: Message = { role: 'user', content, timestamp: new Date().toISOString() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/antonio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          marmoraria: { id: marmoraria.id, nome: marmoraria.nome },
          catalogo: { materiais, servicos, clientes },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = res.status === 402 || res.status === 500
          ? 'O Antonio está temporariamente indisponível. Adicione créditos em console.anthropic.com para ativá-lo.'
          : (data.error || 'Erro na API')
        throw new Error(msg)
      }
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        orcamentoId: data.orcamentoId || undefined,
      }
      const final = [...next, assistantMsg]
      setMessages(final)
      persistSession(final, currentSessionId)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao conectar com o agente', 'err')
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, marmoraria, materiais, servicos, clientes, currentSessionId, toast])

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
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
        } finally { setLoading(false) }
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

  if (marmoraria?.plano !== 'enterprise') {
    return (
      <div className="page-inner">
        <div className="page-header"><h1 className="page-title">Antonio</h1></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center' }}>
          <Avatar size={80} />
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: 0 }}>Conheça o Antonio</h2>
          <p style={{ color: 'var(--gray)', maxWidth: 460, lineHeight: 1.7, margin: 0 }}>
            O Antonio é seu especialista virtual em marmoraria — cria orçamentos, consulta sua agenda, busca clientes e responde dúvidas técnicas, tudo por chat ou voz. Disponível no Plano Enterprise.
          </p>
          <button className="btn btn-gold" style={{ padding: '14px 32px', fontSize: 15 }}
            onClick={() => window.open('https://marmoapp.com/#planos', '_blank')}>
            Ver Plano Enterprise →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-inner" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', paddingBottom: 0 }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1 className="page-title">Antonio</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, flex: 1, minHeight: 0 }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingBottom: 16 }}>
          <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
            <Avatar size={72} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--dark)', marginTop: 12 }}>Antonio</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>Seu especialista em marmoraria</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              <span style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--green)' }}>Online · Enterprise</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Ações rápidas</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} className="btn btn-outline"
                  style={{ textAlign: 'left', fontSize: 13, padding: '10px 14px', justifyContent: 'flex-start' }}
                  onClick={() => enviarMensagem(a.message)} disabled={loading}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Conversas recentes</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sessions.map(s => (
                  <button key={s.id} onClick={() => carregarSessao(s)} style={{
                    background: s.id === currentSessionId ? '#FDF8F0' : 'transparent',
                    border: `1px solid ${s.id === currentSessionId ? 'var(--gold)' : '#EDE9E2'}`,
                    borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.firstMessage}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                      {new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita — Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, border: '1px solid #EDE9E2', overflow: 'hidden', minHeight: 0 }}>

          {/* Header do chat */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #EDE9E2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={36} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Conversa com Antonio</div>
                <div style={{ fontSize: 11, color: 'var(--gray)' }}>Powered by Claude Sonnet</div>
              </div>
            </div>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={novaConversa}>
              + Nova conversa
            </button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ alignSelf: 'flex-end', marginRight: 10 }}>
                    <Avatar size={32} />
                  </div>
                )}
                <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? 'var(--gold)' : '#F5F5F5',
                    color: 'var(--dark)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14,
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gray)', textAlign: msg.role === 'user' ? 'right' : 'left', padding: '0 4px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {msg.orcamentoId && <OrcamentoActions orcamentoId={msg.orcamentoId} />}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <Avatar size={32} />
                <div style={{ padding: '14px 18px', background: '#F5F5F5', borderRadius: '18px 18px 18px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 8, height: 8, background: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid #EDE9E2', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <button onClick={recording ? pararGravacao : iniciarGravacao} disabled={loading}
                style={{
                  width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: recording ? '#c0392b' : '#f0f0f0',
                  color: recording ? '#fff' : 'var(--gray)', fontSize: 17, flexShrink: 0,
                  animation: recording ? 'pulse 1s infinite' : 'none',
                }}
                title={recording ? 'Parar gravação' : 'Gravar áudio'}
              >🎤</button>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                placeholder="Digite sua mensagem..."
                disabled={loading || recording}
                style={{ flex: 1, padding: '11px 14px', border: '1.5px solid #e8e8e8', borderRadius: 12, fontSize: 14, fontFamily: 'DM Sans, sans-serif', resize: 'none', minHeight: 42, maxHeight: 120, outline: 'none', lineHeight: 1.5 }}
                rows={1}
              />
              <button className="btn btn-gold" onClick={() => enviarMensagem()}
                disabled={loading || !input.trim()}
                style={{ height: 42, minWidth: 42, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}
              >➤</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gray)', textAlign: 'center' }}>
              Enter para enviar · Shift+Enter para nova linha
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
      `}</style>
    </div>
  )
}

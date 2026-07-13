'use client'

import Link from 'next/link'
import { useState } from 'react'

const s = {
  // Layout
  section: (bg = '#0a0a0a'): React.CSSProperties => ({ background: bg, padding: '72px 20px' }),
  inner: (maxW = 1080): React.CSSProperties => ({ maxWidth: maxW, margin: '0 auto' }),
  // Text
  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 12 },
  h2: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: '#fff', margin: '0 0 16px', lineHeight: 1.2 } as React.CSSProperties,
  h2Dark: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: '#2C2922', margin: '0 0 16px', lineHeight: 1.2 } as React.CSSProperties,
  p: { fontSize: 16, lineHeight: 1.7, color: '#9B8A7A', margin: '0 0 16px' } as React.CSSProperties,
  pDark: { fontSize: 16, lineHeight: 1.7, color: '#666', margin: '0 0 16px' } as React.CSSProperties,
  // Buttons
  btnPrimary: { display: 'inline-block', background: '#C9A84C', color: '#0a0a0a', padding: '16px 32px', borderRadius: 8, fontSize: 16, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { display: 'inline-block', background: 'transparent', color: '#C9A84C', padding: '15px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1.5px solid #C9A84C' } as React.CSSProperties,
}

const PLANOS = [
  {
    id: 'basic', nome: 'Basic', preco: 147, descricao: 'Para marmorarias que querem organizar',
    recursos: ['Orçamentos ilimitados', 'Controle de materiais e preços', 'Markup automático', 'Geração de PDF', 'Relatórios básicos', '1 usuário'],
    destaque: false,
  },
  {
    id: 'pro', nome: 'Pro', preco: 297, descricao: 'Para equipes que querem crescer',
    recursos: ['Tudo do Basic', 'Kanban de produção', 'Até 3 usuários', 'Relatórios financeiros', 'Agenda de serviços', 'Controle de projetos'],
    destaque: true,
  },
  {
    id: 'enterprise', nome: 'Enterprise', preco: 497, descricao: 'Com IA para atender clientes 24h',
    recursos: ['Tudo do Pro', 'Agente IA no WhatsApp (Antônio)', 'Usuários ilimitados', 'Atendimento prioritário', 'IA de orçamento avançada', 'Personalização completa'],
    destaque: false,
  },
]

const FAQS = [
  { q: 'Preciso saber mexer com computador?', a: 'Não. Se você usa WhatsApp, usa o MarmoApp. A interface foi feita para marmoreiros, não para técnicos.' },
  { q: 'Funciona no celular?', a: 'Sim, 100% responsivo. Faça orçamentos pelo celular direto da obra.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa e sem burocracia. Cancele em um clique quando quiser.' },
  { q: 'Como funciona o trial de 7 dias?', a: 'Acesso completo ao plano Pro por 7 dias, sem precisar de cartão de crédito.' },
  { q: 'E se eu precisar de ajuda?', a: 'Suporte via WhatsApp direto com o Vinicius, fundador do MarmoApp. Sem robô, sem fila de espera.' },
  { q: 'O que é o Agente Antônio?', a: 'Uma IA que atende seus clientes pelo WhatsApp, coleta medidas e gera orçamentos automaticamente. Exclusivo do plano Enterprise.' },
]

export default function LandingPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0a0a0a', color: '#fff' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,10,0.95)', borderBottom: '1px solid #1a1a1a', backdropFilter: 'blur(8px)', padding: '0 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
            Marmo<span style={{ color: '#C9A84C' }}>App</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link href="#planos" style={{ fontSize: 13, color: '#9B8A7A', textDecoration: 'none' }}>Planos</Link>
            <Link href="/login" style={{ fontSize: 13, color: '#9B8A7A', textDecoration: 'none' }}>Entrar</Link>
            <Link href="/register?plano=basic" style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', background: '#C9A84C', padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
              Teste grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#111 60%,#0d0d0d 100%)', padding: '80px 20px 72px' }}>
        <div style={{ ...s.inner(), textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, marginBottom: 24 }}>
            Usado por marmorarias em SP, MG e PR
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, color: '#fff', margin: '0 0 20px', lineHeight: 1.15, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
            Sua marmoraria fatura mais quando para de perder margem no orçamento
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,19px)', color: '#9B8A7A', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.7 }}>
            MarmoApp calcula orçamentos precisos em 2 minutos, controla sua produção e ainda atende seus clientes pelo WhatsApp com inteligência artificial.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?plano=basic" style={s.btnPrimary}>Teste grátis por 7 dias →</Link>
            <Link href="#como-funciona" style={s.btnSecondary}>Ver como funciona</Link>
          </div>
          <p style={{ marginTop: 20, fontSize: 13, color: '#555' }}>Cartão cobrado após o trial · Cancele quando quiser</p>

          {/* Dashboard mockup */}
          <div style={{ marginTop: 56, background: '#111', borderRadius: 14, border: '1px solid #222', padding: '20px', maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
              {[['MRR', 'R$ 4.719', '#C9A84C'],['Orçamentos hoje', '8', '#60a5fa'],['Margem média', '38%', '#34d399'],['Trials ativos', '12', '#a78bfa']].map(([l,v,c]) => (
                <div key={l} style={{ background: '#1a1a1a', borderRadius: 8, padding: '12px 14px', border: '1px solid #222' }}>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '12px 14px', border: '1px solid #222' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>ORÇAMENTOS RECENTES</div>
              {[['Pia cozinha — Carlos M.','R$ 1.840','38%'],['Bancada banheiro — Ana R.','R$ 620','42%'],['Escada mármore — Construtora X','R$ 5.200','31%']].map(([n,v,m]) => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222', fontSize: 12 }}>
                  <span style={{ color: '#888' }}>{n}</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
                  <span style={{ color: '#34d399' }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DORES */}
      <section style={s.section('#f8f6f2')}>
        <div style={s.inner()}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={s.sectionLabel}>Identificação</p>
            <h2 style={s.h2Dark}>Reconhece alguma dessas situações?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              ['📋','Orçamento feito no papel ou WhatsApp, sem controle de margem'],
              ['💸','Entregou obra e só depois descobriu que saiu no prejuízo'],
              ['📱','Cliente ligando a toda hora perguntando sobre o orçamento'],
              ['🗂️','Não sabe quais obras estão atrasadas sem perguntar pro funcionário'],
              ['⏰','Leva mais de 30 minutos para montar um orçamento completo'],
              ['📊','Não tem ideia de quanto fatura por mês de verdade'],
            ].map(([icon, texto]) => (
              <div key={texto} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #EDE9E2', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#2C2922' }}>{texto}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href="/register?plano=basic" style={{ ...s.btnPrimary, background: '#2C2922', color: '#C9A84C' }}>
              Resolver isso agora →
            </Link>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" style={s.section('#0a0a0a')}>
        <div style={s.inner()}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={s.sectionLabel}>Como funciona</p>
            <h2 style={s.h2}>Do pedido ao orçamento em 2 minutos</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {[
              ['01','Cadastre seus materiais e preços uma vez','Granito, mármore, quartzito, serviços de instalação e polimento — com markup automático. Faz uma vez, usa sempre.'],
              ['02','Selecione os itens do projeto do cliente','Medidas, acabamentos, serviços de instalação. O sistema calcula custo e margem na hora.'],
              ['03','Orçamento pronto para enviar pelo WhatsApp','Com valor, validade, prazo de entrega e sua assinatura. PDF em segundos.'],
            ].map(([num, titulo, desc]) => (
              <div key={num} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '28px 24px' }}>
                <div style={{ width: 40, height: 40, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#C9A84C', marginBottom: 16 }}>
                  {num}
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>{titulo}</h3>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" style={s.section('#f8f6f2')}>
        <div style={s.inner()}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={s.sectionLabel}>Planos</p>
            <h2 style={s.h2Dark}>Escolha o plano da sua marmoraria</h2>
            <p style={{ fontSize: 14, color: '#9B8A7A' }}>7 dias grátis em todos os planos · Cartão cobrado após o trial</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {PLANOS.map(p => (
              <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: '28px 24px', border: p.destaque ? '2px solid #C9A84C' : '1px solid #EDE9E2', position: 'relative', boxShadow: p.destaque ? '0 8px 32px rgba(201,168,76,0.15)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
                {p.destaque && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#C9A84C', color: '#2C2922', padding: '3px 16px', borderRadius: 12, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
                    ⭐ MAIS POPULAR
                  </div>
                )}
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: '#2C2922', marginBottom: 4 }}>{p.nome}</div>
                <div style={{ fontSize: 13, color: '#9B8A7A', marginBottom: 20 }}>{p.descricao}</div>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#2C2922' }}>R${p.preco}</span>
                  <span style={{ fontSize: 13, color: '#9B8A7A' }}>/mês</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.recursos.map(r => (
                    <li key={r} style={{ fontSize: 13, color: '#2C2922', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#27AE60', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plano=${p.id}`}
                  style={{ display: 'block', textAlign: 'center', padding: '13px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', background: p.destaque ? '#C9A84C' : 'transparent', color: '#2C2922', border: p.destaque ? 'none' : '2px solid #2C2922' }}
                >
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section style={s.section('#0a0a0a')}>
        <div style={s.inner(900)}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={s.sectionLabel}>Prova social</p>
            <h2 style={s.h2}>Marmorarias que já usam o MarmoApp</h2>
          </div>

          {/* Depoimento */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '36px 40px', marginBottom: 40, position: 'relative' }}>
            <div style={{ fontSize: 48, color: '#C9A84C', lineHeight: 1, marginBottom: 16, opacity: 0.6 }}>"</div>
            <p style={{ fontSize: 'clamp(17px,2vw,20px)', lineHeight: 1.7, color: '#e5e5e5', margin: '0 0 24px', fontStyle: 'italic' }}>
              Antes eu levava 40 minutos para montar um orçamento. Hoje faço em 3 minutos e ainda sei exatamente quanto vou ganhar em cada obra.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, background: '#222', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👷</div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Roberto Silva</div>
                <div style={{ fontSize: 13, color: '#666' }}>Real Pedras Marmoraria · Arujá-SP</div>
              </div>
            </div>
          </div>

          {/* Números */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {[['85%','menos tempo para orçar'],['Zero','orçamentos no prejuízo'],['Controle total','da produção']].map(([num, desc]) => (
              <div key={num} style={{ textAlign: 'center', background: '#111', borderRadius: 12, padding: '28px 20px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: '#C9A84C', marginBottom: 8 }}>{num}</div>
                <div style={{ fontSize: 14, color: '#666' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={s.section('#f8f6f2')}>
        <div style={s.inner(720)}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={s.sectionLabel}>FAQ</p>
            <h2 style={s.h2Dark}>Perguntas frequentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #EDE9E2', overflow: 'hidden' }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{ width: '100%', padding: '16px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#2C2922' }}>{faq.q}</span>
                  <span style={{ color: '#C9A84C', fontSize: 18, flexShrink: 0, transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
                </button>
                {faqOpen === i && (
                  <div style={{ padding: '0 20px 16px', fontSize: 14, lineHeight: 1.7, color: '#666' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: 'linear-gradient(135deg,#111 0%,#1a1508 100%)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={s.inner(640)}>
          <p style={s.sectionLabel}>Comece hoje</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, color: '#fff', margin: '0 0 16px', lineHeight: 1.2 }}>
            Faça seu primeiro orçamento em 5 minutos
          </h2>
          <p style={{ fontSize: 16, color: '#9B8A7A', marginBottom: 36 }}>
            7 dias grátis, sem cartão de crédito, cancele quando quiser
          </p>
          <Link href="/register?plano=basic" style={{ ...s.btnPrimary, fontSize: 17, padding: '18px 40px' }}>
            Quero testar grátis →
          </Link>
          <div style={{ marginTop: 24 }}>
            <Link href="/login" style={{ fontSize: 14, color: '#666', textDecoration: 'none' }}>
              Já tem conta? <span style={{ color: '#C9A84C', fontWeight: 600 }}>Entrar →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer style={{ background: '#050505', borderTop: '1px solid #111', padding: '32px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Marmo<span style={{ color: '#C9A84C' }}>App</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['Planos','#planos'],['Entrar','/login'],['Cadastrar','/register'],['Instagram','https://instagram.com/marmoapp.oficial'],['WhatsApp','https://wa.me/5511947340955']].map(([label,href]) => (
              <a key={label} href={href} style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>{label}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#333', margin: 0 }}>© 2026 MarmoApp. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

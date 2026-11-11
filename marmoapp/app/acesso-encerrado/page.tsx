'use client'

import { useApp } from '@/contexts/AppContext'

// Tela mostrada quando o período de teste combinado com o time MarmoApp termina
// (marmorarias.acesso_ate no passado). Os dados continuam guardados.
const WHATSAPP = '5511947340955'

export default function AcessoEncerradoPage() {
  const { marmoraria } = useApp()
  const nome = marmoraria?.nome?.trim()
  const msg = encodeURIComponent(`Olá! Sou da ${nome || 'marmoraria'} e quero continuar usando o MarmoApp.`)

  async function sair() {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-marmoapp.jpg" alt="MarmoApp" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', margin: '0 auto 16px' }} />
        <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, color: '#111827', margin: '0 0 8px' }}>
          Seu período de teste terminou
        </h1>
        <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>
          {nome ? `Os dados da ${nome} ` : 'Seus dados '}continuam guardados: orçamentos, clientes e a tabela de pedras.
          Para continuar usando o MarmoApp, fale com a gente e assine o seu plano.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP}?text=${msg}`}
          target="_blank"
          rel="noopener"
          style={{ display: 'block', background: '#C9A84C', color: '#0D0D0D', fontWeight: 600, padding: '12px 16px', borderRadius: 8, textDecoration: 'none', marginBottom: 10 }}
        >
          Falar com o MarmoApp no WhatsApp
        </a>
        <button onClick={sair} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>
          Sair da conta
        </button>
      </div>
    </div>
  )
}

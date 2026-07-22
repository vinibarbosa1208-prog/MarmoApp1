'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

export default function CheckoutPage() {
  const { marmoraria } = useApp()
  const router = useRouter()
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!marmoraria) return

    // Já tem trial/assinatura → vai pro dashboard
    if (marmoraria.trial_expira) {
      router.replace('/dashboard')
      return
    }

    // Inicia Stripe checkout automaticamente
    fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano: marmoraria.plano || 'pro' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url
        } else {
          setErro(data.error || 'Erro ao iniciar pagamento.')
        }
      })
      .catch(() => setErro('Erro de conexão. Tente novamente.'))
  }, [marmoraria, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      fontFamily: "'DM Sans', sans-serif",
      gap: 16,
    }}>
      <div style={{ fontFamily: 'serif', fontSize: 26, color: '#fff' }}>
        Marmo<span style={{ color: '#C9A84C' }}>App</span>
      </div>

      {erro ? (
        <div style={{ color: '#f87171', fontSize: 14, maxWidth: 320, textAlign: 'center' }}>
          {erro}
          <br /><br />
          <button
            onClick={() => { setErro(''); }}
            style={{ color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div style={{ color: '#9B8A7A', fontSize: 14 }}>Redirecionando para o pagamento…</div>
          <div style={{
            width: 32, height: 32,
            border: '3px solid #C9A84C',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </>
      )}
    </div>
  )
}

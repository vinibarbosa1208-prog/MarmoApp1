'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Usa a infraestrutura de log que já existia no projeto (tabela error_logs
    // + rota /api/log-error), só que nunca era chamada por ninguém até agora.
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        error_message: error.message,
        error_stack: error.stack,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 32, textAlign: 'center', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, margin: '0 0 8px', color: 'var(--dark, #1A1A2E)' }}>
        Ops, algo deu errado
      </h2>
      <p style={{ color: 'var(--gray, #888)', margin: '0 0 24px', maxWidth: 400 }}>
        Já registramos o problema automaticamente. Tenta recarregar — se continuar acontecendo, é só nos avisar.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => reset()}
          style={{
            background: 'var(--gold, #C9A84C)', color: 'var(--dark, #1A1A2E)', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
        <a
          href="/dashboard"
          style={{
            background: 'transparent', color: 'var(--dark, #1A1A2E)', border: '1px solid #ccc',
            borderRadius: 8, padding: '10px 20px', fontWeight: 700, textDecoration: 'none',
          }}
        >
          Ir pro início
        </a>
      </div>
    </div>
  )
}

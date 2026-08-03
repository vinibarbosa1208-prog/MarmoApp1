'use client'

import { useEffect } from 'react'

// Só entra em ação se o próprio layout raiz quebrar (caso raro). Precisa ter
// <html> e <body> próprios porque substitui o layout inteiro.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
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
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 22, margin: '0 0 8px', color: '#1A1A2E' }}>Ops, algo deu errado</h2>
          <p style={{ color: '#888', margin: '0 0 24px', maxWidth: 400 }}>
            Já registramos o problema automaticamente. Tenta recarregar a página.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#C9A84C', color: '#1A1A2E', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}

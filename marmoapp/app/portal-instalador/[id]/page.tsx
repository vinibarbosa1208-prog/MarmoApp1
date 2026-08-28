'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Instalador {
  id: string
  nome: string
}

// Tela do instalador depois de se identificar. Por enquanto só o
// esqueleto (a lista de obras/registro de item é a fase 3, ainda não
// construída) — o objetivo desta fase (5b) era só trocar a porta de
// entrada de login pra identificação por nome.
export default function PortalInstaladorObrasPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [instalador, setInstalador] = useState<Instalador | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/portal-instalador/funcionario/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setInstalador)
      .catch(() => setErro('Instalador não encontrado.'))
  }, [id])

  if (erro) {
    return (
      <div>
        <p style={{ color: 'var(--red)', marginBottom: 16 }}>{erro}</p>
        <button className="btn btn-outline btn-sm" onClick={() => router.push('/portal-instalador')}>← Voltar</button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => router.push('/portal-instalador')}
        style={{ background: 'none', border: 'none', color: 'var(--gray)', fontSize: 13, marginBottom: 12, cursor: 'pointer', padding: 0 }}
      >
        ← Trocar pessoa
      </button>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>
        Olá, {instalador?.nome ?? '…'}
      </h1>
      <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 24 }}>
        Suas obras atribuídas vão aparecer aqui.
      </p>
      <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', color: 'var(--gray)', fontSize: 14 }}>
        Em construção — em breve você vai poder ver suas obras e registrar as peças instaladas por aqui.
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Instalador {
  id: string
  nome: string
}

// Tela de identificação — fase 5b: sem senha, o instalador só toca no
// próprio nome. Lista vem de uma rota de servidor (sem auth de propósito).
//
// Ficha semanal de produção (06/10/2026): a rota responde 410 quando
// `portal_instalador_ativo` está desligado — nesse caso, mostra o aviso de
// desativação no lugar da lista de nomes.
export default function PortalInstaladorPage() {
  const router = useRouter()
  const [instaladores, setInstaladores] = useState<Instalador[] | null>(null)
  const [erro, setErro] = useState('')
  const [desativado, setDesativado] = useState(false)

  useEffect(() => {
    fetch('/api/portal-instalador/instaladores')
      .then(async r => {
        if (r.status === 410) {
          const d = await r.json().catch(() => ({}))
          setDesativado(true)
          setErro(d.error || 'Os registros de instalação agora são feitos pela ficha semanal')
          return
        }
        if (!r.ok) throw r
        setInstaladores(await r.json())
      })
      .catch(() => setErro('Não foi possível carregar a lista. Tente recarregar a página.'))
  }, [])

  if (desativado) {
    return (
      <div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>Portal desativado</h1>
        <div style={{
          background: '#fff', border: '1px solid var(--marble2)', borderRadius: 8,
          padding: '18px 20px', fontSize: 15, color: 'var(--dark)', boxShadow: 'var(--shadow)',
        }}>
          {erro}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>Quem é você?</h1>
      <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 20 }}>
        Toque no seu nome para ver suas obras.
      </p>

      {erro && <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>{erro}</div>}
      {instaladores === null && !erro && <div style={{ color: 'var(--gray)' }}>Carregando…</div>}
      {instaladores?.length === 0 && (
        <div style={{ color: 'var(--gray)', fontSize: 14 }}>
          Nenhum instalador cadastrado ainda. Peça ao gestor pra cadastrar em Configurações → Funcionários.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {instaladores?.map(i => (
          <button
            key={i.id}
            onClick={() => router.push(`/portal-instalador/${i.id}`)}
            style={{
              textAlign: 'left', background: '#fff', border: '1px solid var(--marble2)', borderRadius: 8,
              padding: '16px 18px', fontSize: 16, fontWeight: 600, color: 'var(--dark)', cursor: 'pointer',
              boxShadow: 'var(--shadow)',
            }}
          >
            {i.nome}
          </button>
        ))}
      </div>
    </div>
  )
}

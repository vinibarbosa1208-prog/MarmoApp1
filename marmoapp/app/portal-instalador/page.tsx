'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase'

// Fase 2: só o esqueleto do portal (login restrito + boas-vindas), pra validar
// o acesso ponta a ponta antes de construir a lista de obras (fase 3).
export default function PortalInstaladorPage() {
  const { user } = useAuth()
  const [nome, setNome] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle()
      .then(({ data }) => setNome(data?.nome ?? null))
  }, [user])

  return (
    <div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>
        Olá, {nome ?? user?.email}
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

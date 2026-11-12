'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Liga a campanha do Meta a um investimento do Financeiro: o gasto passa a entrar lá sozinho.
export default function VinculoCampanha({
  campaignId,
  atual,
  investimentos,
}: {
  campaignId: string
  atual: string | null
  investimentos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [valor, setValor] = useState(atual ?? '')
  const [salvando, setSalvando] = useState(false)

  async function trocar(v: string) {
    setValor(v)
    setSalvando(true)
    await fetch(`/api/meta/campanhas/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investimento_id: v || null }),
    })
    setSalvando(false)
    router.refresh()
  }

  return (
    <select className="campo w-48" value={valor} disabled={salvando} onChange={(e) => trocar(e.target.value)}>
      <option value="">— não ligado —</option>
      {investimentos.map((i) => (
        <option key={i.id} value={i.id}>
          {i.nome}
        </option>
      ))}
    </select>
  )
}

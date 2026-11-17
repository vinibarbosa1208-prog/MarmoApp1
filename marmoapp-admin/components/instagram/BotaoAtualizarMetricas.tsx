'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BotaoAtualizarMetricas() {
  const router = useRouter()
  const [estado, setEstado] = useState('')

  async function rodar() {
    setEstado('rodando')
    const r = await fetch('/api/instagram/metricas', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setEstado(r.ok ? `Atualizado: ${j.seguidores} seguidores` : (j.error ?? 'Não foi possível atualizar'))
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {estado && estado !== 'rodando' && <span className="max-w-md text-xs text-gray-500">{estado}</span>}
      <button className="btn-gold btn-sm" disabled={estado === 'rodando'} onClick={rodar}>
        {estado === 'rodando' ? 'Buscando no Instagram…' : 'Atualizar agora'}
      </button>
    </div>
  )
}

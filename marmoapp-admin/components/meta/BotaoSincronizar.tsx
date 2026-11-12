'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BotaoSincronizar({ desabilitado }: { desabilitado?: boolean }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'' | 'rodando' | string>('')

  async function rodar() {
    setEstado('rodando')
    const r = await fetch('/api/meta/sincronizar', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setEstado(r.ok ? `Atualizado: ${j.campanhas} campanha(s), ${j.linhas} dia(s) de dados` : (j.error ?? 'Não foi possível atualizar'))
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {estado && estado !== 'rodando' && <span className="max-w-md text-xs text-gray-500">{estado}</span>}
      <button className="btn-gold btn-sm" disabled={desabilitado || estado === 'rodando'} onClick={rodar}>
        {estado === 'rodando' ? 'Buscando no Meta…' : 'Atualizar agora'}
      </button>
    </div>
  )
}

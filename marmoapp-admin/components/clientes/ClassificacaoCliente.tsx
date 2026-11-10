'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TIPOS_CLIENTE, type TipoCliente } from '@/lib/financeiro'

// Define se a marmoraria é contratante, cadastro, teste ou conta interna.
// Testes e internas ficam fora de todos os números do painel.
export default function ClassificacaoCliente({ id, tipo }: { id: string; tipo: TipoCliente }) {
  const router = useRouter()
  const [valor, setValor] = useState(tipo)
  const [estado, setEstado] = useState('')

  async function salvar(t: TipoCliente) {
    setValor(t)
    setEstado('Salvando…')
    const r = await fetch(`/api/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: t }),
    })
    setEstado(r.ok ? 'Salvo' : 'Não salvou')
    if (r.ok) router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TIPOS_CLIENTE.map((t) => (
        <button
          key={t.valor}
          type="button"
          title={t.ajuda}
          onClick={() => salvar(t.valor)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            valor === t.valor ? 'border-gold bg-gold text-[#0D0D0D]' : 'border-gray-200 bg-white text-gray-600 hover:border-gold'
          }`}
        >
          {t.nome}
        </button>
      ))}
      {estado && <span className="ml-1 text-xs text-gray-400">{estado}</span>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dataBR, hojeBR } from '@/lib/financeiro'

// Período de teste com data marcada: até a data, a marmoraria usa o sistema;
// depois, vê a tela "Seu período de teste terminou" (dados continuam guardados).
export default function AcessoCliente({ id, acessoAte }: { id: string; acessoAte: string | null }) {
  const router = useRouter()
  const atual = acessoAte ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(acessoAte)) : ''
  const [data, setData] = useState(atual)
  const [estado, setEstado] = useState('')
  const encerrado = !!atual && atual < hojeBR()

  async function salvar(v: string | null) {
    setEstado('Salvando…')
    const r = await fetch(`/api/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acesso_ate: v }),
    })
    const j = await r.json().catch(() => ({}))
    setEstado(r.ok ? 'Salvo' : (j.error ?? 'Não salvou'))
    if (r.ok) {
      if (v === null) setData('')
      router.refresh()
    }
  }

  return (
    <div>
      <p className="rotulo">Acesso ao sistema</p>
      <p className="mb-2 text-sm text-gray-600">
        {!atual
          ? 'Sem data de corte.'
          : encerrado
            ? `Teste encerrado em ${dataBR(atual)}.`
            : `Teste liberado até ${dataBR(atual)}, 23:59.`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="campo w-40" value={data} onChange={(e) => setData(e.target.value)} />
        <button className="btn-gold btn-sm" disabled={!data} onClick={() => salvar(data)}>
          Liberar até esta data
        </button>
        {atual && (
          <button className="btn-outline btn-sm" onClick={() => salvar(null)} title="Acesso sem data de corte (cliente contratou)">
            Remover corte
          </button>
        )}
        {estado && <span className="text-xs text-gray-400">{estado}</span>}
      </div>
    </div>
  )
}

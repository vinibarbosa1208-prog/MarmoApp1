'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { PLANOS, type PlanoKey } from '@/lib/contrato/modelo'

interface Linha {
  id: string
  numero: string
  status: string
  plano: PlanoKey
  primeira_cobranca: number
  contratante: { razao_social?: string }
  enviado_em: string | null
  assinado_em: string | null
  link_pagamento: string | null
  created_at: string
}

const COR: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  enviado: 'bg-amber-500/20 text-amber-700',
  assinado: 'bg-emerald-500/20 text-emerald-700',
  cancelado: 'bg-red-500/20 text-red-700',
}
const data = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')

export default function ContratosPage() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/contratos')
      .then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setLinhas(j.contratos ?? [])))
      .catch(() => setErro('Não consegui carregar os contratos.'))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Contratos"
        subtitle="Gerados no fechamento da call e assinados online"
        action={
          <Link href="/contratos/novo" className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium text-[#0D0D0D] hover:bg-gold2">
            Novo contrato
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        {erro && <p className="mb-4 text-red-700">{erro}</p>}
        {carregando ? (
          <p className="text-gray-600">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="text-gray-600">Nenhum contrato ainda. Crie o primeiro pelo botão acima ou pela apresentação, ao marcar &quot;Fechou&quot;.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Número</th>
                <th className="pb-2">Marmoraria</th>
                <th className="pb-2">Plano</th>
                <th className="pb-2">1ª cobrança</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Enviado</th>
                <th className="pb-2">Assinado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.id} className="border-t border-gray-200 hover:bg-white">
                  <td className="py-2.5">
                    <Link href={`/contratos/${c.id}`} className="text-gold-dk hover:underline">
                      {c.numero}
                    </Link>
                  </td>
                  <td>{c.contratante?.razao_social || '—'}</td>
                  <td>{PLANOS[c.plano]?.nome ?? c.plano}</td>
                  <td>{Number(c.primeira_cobranca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${COR[c.status] ?? ''}`}>{c.status}</span>
                  </td>
                  <td>{data(c.enviado_em)}</td>
                  <td>{data(c.assinado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

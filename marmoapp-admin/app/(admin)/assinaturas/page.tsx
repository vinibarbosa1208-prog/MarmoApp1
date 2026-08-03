'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import PlanDonutChartLazy from '@/components/charts/PlanDonutChartLazy'
import { PLANO_PRECOS } from '@/lib/types'
import type { Assinatura } from '@/lib/types'

interface AssinaturaRow extends Assinatura {
  marmorarias: { nome: string; plano: string | null } | null
}

export default function AssinaturasPage() {
  const [assinaturas, setAssinaturas] = useState<AssinaturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFiltro, setStatusFiltro] = useState('all')

  useEffect(() => {
    async function fetch_() {
      const res = await fetch('/api/metricas')
      if (res.ok) {
        const data = await res.json()
        setAssinaturas(data.assinaturas ?? [])
      }
      setLoading(false)
    }
    fetch_()
  }, [])

  const filtered =
    statusFiltro === 'all'
      ? assinaturas
      : assinaturas.filter((a) => a.status === statusFiltro)

  const mrr = assinaturas.reduce((acc, a) => {
    const plano = a.marmorarias?.plano
    return acc + (plano ? (PLANO_PRECOS[plano] ?? 0) : 0)
  }, 0)

  const planCounts: Record<string, number> = {}
  for (const a of assinaturas) {
    const p = a.marmorarias?.plano ?? 'sem plano'
    planCounts[p] = (planCounts[p] ?? 0) + 1
  }
  const donutData = Object.entries(planCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="flex flex-col">
      <Header title="Assinaturas" subtitle="Planos e receita" />

      <main className="p-6 space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">MRR Total</p>
            <p className="text-3xl font-bold text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              ARR:{' '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                mrr * 12
              )}
            </p>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Distribuição de planos</p>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                Carregando...
              </div>
            ) : (
              <PlanDonutChartLazy data={donutData} />
            )}
          </div>
        </div>

        {/* Filtro + Tabela */}
        <div className="space-y-3">
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="canceled">Cancelado</option>
            <option value="past_due">Em atraso</option>
            <option value="trial">Trial</option>
          </select>

          <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Marmoraria', 'Plano', 'Status', 'Stripe Customer', 'Valor/mês', 'Ação'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filtered.map((a) => {
                    const plano = a.marmorarias?.plano
                    const valor = plano ? (PLANO_PRECOS[plano] ?? 0) : 0
                    return (
                      <tr key={a.id} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-white font-medium">
                          {a.marmorarias?.nome ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={plano ?? null} type="plano" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={a.status} type="status" />
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {a.stripe_customer_id ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {valor > 0
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(valor)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {a.stripe_customer_id && (
                            <a
                              href={`https://dashboard.stripe.com/customers/${a.stripe_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
                            >
                              Stripe ↗
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                        Nenhuma assinatura encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

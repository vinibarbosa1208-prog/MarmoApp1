'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import NovoClienteModal from '@/components/NovoClienteModal'
import { format, parseISO } from 'date-fns'
import type { Marmoraria } from '@/lib/types'

interface ClienteRow extends Marmoraria {
  usuarios_count: number
  orcamentos_count: number
  ultimo_orcamento: string | null
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [planoFiltro, setPlanoFiltro] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [extendsLoading, setExtendsLoading] = useState<string | null>(null)

  async function fetchClientes() {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    if (planoFiltro !== 'all') params.set('plano', planoFiltro)
    const res = await fetch(`/api/clientes?${params}`)
    if (res.ok) {
      const data = await res.json()
      setClientes(data.clientes ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchClientes()
  }, [busca, planoFiltro])

  async function extenderTrial(id: string) {
    setExtendsLoading(id)
    await fetch(`/api/clientes/${id}/trial`, { method: 'POST' })
    setExtendsLoading(null)
    fetchClientes()
  }

  return (
    <>
      {showModal && <NovoClienteModal onClose={() => { setShowModal(false); fetchClientes() }} />}

      <div className="flex flex-col h-full">
        <Header
          title="Clientes"
          subtitle={`${clientes.length} marmorarias`}
          action={
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              + Novo Cliente
            </button>
          }
        />

        <div className="p-6 space-y-4">
          {/* Filtros */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none w-64"
            />
            <select
              value={planoFiltro}
              onChange={(e) => setPlanoFiltro(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Todos os planos</option>
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Tabela */}
          <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Nome', 'Plano', 'Setup', 'Usuários', 'Orçamentos', 'Último uso', 'Trial expira', 'Ações'].map(
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
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{c.nome}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={c.plano} type="plano" />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${c.setup_concluido ? 'text-emerald-400' : 'text-slate-500'}`}
                        >
                          {c.setup_concluido ? '✓ Sim' : '✗ Não'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{c.usuarios_count}</td>
                      <td className="px-4 py-3 text-slate-400">{c.orcamentos_count}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {c.ultimo_orcamento
                          ? format(parseISO(c.ultimo_orcamento), 'dd/MM/yy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {c.trial_expira
                          ? format(parseISO(c.trial_expira), 'dd/MM/yy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {c.plano === 'trial' && (
                            <button
                              onClick={() => extenderTrial(c.id)}
                              disabled={extendsLoading === c.id}
                              className="rounded bg-yellow-700 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                            >
                              +7d
                            </button>
                          )}
                          <Link
                            href={`/clientes/${c.id}`}
                            className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
                          >
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clientes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                        Nenhum cliente encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

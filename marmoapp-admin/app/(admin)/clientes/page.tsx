'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import NovoClienteModal from '@/components/NovoClienteModal'
import { format, parseISO } from 'date-fns'
import type { Marmoraria } from '@/lib/types'
import { brl, COR_TIPO, TIPOS_CLIENTE, type TipoCliente } from '@/lib/financeiro'

interface ClienteRow extends Marmoraria {
  tipo: TipoCliente
  receita_mensal: number
  usuarios_count: number
  orcamentos_count: number
  ultimo_orcamento: string | null
}


export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('reais')
  const [showModal, setShowModal] = useState(false)
  const [extendsLoading, setExtendsLoading] = useState<string | null>(null)

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    const res = await fetch(`/api/clientes?${params}`)
    if (res.ok) {
      const data = await res.json()
      setClientes(data.clientes ?? [])
    }
    setLoading(false)
  }, [busca])

  useEffect(() => {
    Promise.resolve().then(fetchClientes)
  }, [fetchClientes])

  async function extenderTrial(id: string) {
    setExtendsLoading(id)
    await fetch(`/api/clientes/${id}/trial`, { method: 'POST' })
    setExtendsLoading(null)
    fetchClientes()
  }

  const visiveis = clientes
    .filter((c) =>
      tipoFiltro === 'todos' ? true : tipoFiltro === 'reais' ? c.tipo !== 'teste' && c.tipo !== 'interno' : c.tipo === tipoFiltro,
    )
    .sort((a, b) => Number(b.tipo === 'contratante') - Number(a.tipo === 'contratante') || b.receita_mensal - a.receita_mensal)
  const contratantes = clientes.filter((c) => c.tipo === 'contratante').length

  return (
    <>
      {showModal && (
        <NovoClienteModal
          onClose={() => {
            setShowModal(false)
            fetchClientes()
          }}
        />
      )}

      <div className="flex h-full flex-col">
        <Header
          title="Clientes"
          subtitle={`${visiveis.length} marmoraria(s) na lista · ${contratantes} contratante(s)`}
          action={
            <button onClick={() => setShowModal(true)} className="btn-gold">
              + Novo cliente
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="campo w-64"
            />
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="campo w-56">
              <option value="reais">Sem contas de teste e internas</option>
              {TIPOS_CLIENTE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
              <option value="todos">Todas as contas</option>
            </select>
          </div>

          <div className="card overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Marmoraria', 'Situação', 'Receita/mês', 'Plano no sistema', 'Usuários', 'Orçamentos', 'Último orçamento', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/clientes/${c.id}`} className="hover:text-gold-dk">
                          {c.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${COR_TIPO[c.tipo]}`}>
                          {TIPOS_CLIENTE.find((t) => t.valor === c.tipo)?.nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.receita_mensal > 0 ? brl(c.receita_mensal) : '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={c.plano} type="plano" />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.usuarios_count}</td>
                      <td className="px-4 py-3 text-gray-600">{c.orcamentos_count}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.ultimo_orcamento ? format(parseISO(c.ultimo_orcamento), 'dd/MM/yy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {c.plano === 'trial' && c.tipo === 'cadastro' && (
                            <button
                              onClick={() => extenderTrial(c.id)}
                              disabled={extendsLoading === c.id}
                              className="btn-outline btn-sm"
                              title="Estender o teste grátis em 7 dias"
                            >
                              +7 dias
                            </button>
                          )}
                          <Link href={`/clientes/${c.id}`} className="btn-gold btn-sm">
                            Abrir
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visiveis.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
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

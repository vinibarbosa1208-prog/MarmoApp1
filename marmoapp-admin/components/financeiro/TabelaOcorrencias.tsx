'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brl, dataBR, hojeBR, nomeCategoria, ROTULO_STATUS, type Ocorrencia, type StatusOcorrencia } from '@/lib/financeiro'

const COR: Record<StatusOcorrencia, string> = {
  previsto: 'bg-gray-100 text-gray-700 border-gray-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  realizado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado: 'bg-gray-50 text-gray-400 border-gray-200',
}

interface Props {
  ocorrencias: Ocorrencia[]
  nomesClientes?: Record<string, string>
  nomesInvestimentos?: Record<string, string>
  vazio?: string
  mostrarCliente?: boolean
}

// Lista de datas de entradas/saídas com as ações do dia a dia:
// marcar recebido/pago, pular uma data, desfazer, encerrar recorrência, excluir.
export default function TabelaOcorrencias({
  ocorrencias,
  nomesClientes = {},
  nomesInvestimentos = {},
  vazio = 'Nada previsto neste período.',
  mostrarCliente = true,
}: Props) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [dataReal, setDataReal] = useState('')

  async function chamar(o: Ocorrencia, corpo: Record<string, unknown>, metodo = 'POST') {
    setOcupado(o.chave)
    setErro('')
    const r = await fetch(`/api/financeiro/lancamentos/${o.lancamento_id}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: metodo === 'DELETE' ? undefined : JSON.stringify({ data: o.data, ...corpo }),
    })
    const j = await r.json().catch(() => ({}))
    setOcupado(null)
    if (!r.ok) {
      setErro(j.error ?? 'Não foi possível salvar.')
      return
    }
    setEditando(null)
    router.refresh()
  }

  function abrirRealizar(o: Ocorrencia) {
    setEditando(o.chave)
    setValor(String(o.valor))
    setDataReal(hojeBR())
  }

  if (ocorrencias.length === 0) return <p className="p-6 text-sm text-gray-500">{vazio}</p>

  return (
    <div className="overflow-x-auto">
      {erro && <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {['Data', 'Descrição', ...(mostrarCliente ? ['Cliente / campanha'] : []), 'Valor', 'Situação', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ocorrencias.map((o) => {
            const aberto = o.status === 'previsto' || o.status === 'atrasado'
            const vinculo =
              (o.marmoraria_id && nomesClientes[o.marmoraria_id]) || (o.investimento_id && nomesInvestimentos[o.investimento_id]) || '—'
            return (
              <tr key={o.chave} className={o.status === 'cancelado' ? 'opacity-60' : ''}>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{dataBR(o.data)}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{o.descricao}</span>
                  <span className="block text-xs text-gray-500">
                    {o.tipo === 'entrada' ? 'Entrada' : 'Saída'} · {nomeCategoria(o.tipo, o.categoria)}
                    {o.recorrente && ' · recorrente'}
                  </span>
                </td>
                {mostrarCliente && <td className="px-4 py-3 text-gray-600">{vinculo}</td>}
                <td className={`whitespace-nowrap px-4 py-3 font-semibold ${o.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {o.tipo === 'entrada' ? '+ ' : '− '}
                  {brl(o.valor)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${COR[o.status]}`}>
                    {o.status === 'realizado' ? (o.tipo === 'entrada' ? 'Recebido' : 'Pago') : ROTULO_STATUS[o.status]}
                  </span>
                  {o.status === 'realizado' && o.data_realizada && o.data_realizada !== o.data && (
                    <span className="block text-[11px] text-gray-400">em {dataBR(o.data_realizada)}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editando === o.chave ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="campo w-28" aria-label="Valor" />
                      <input type="date" value={dataReal} onChange={(e) => setDataReal(e.target.value)} className="campo w-36" aria-label="Data" />
                      <button
                        className="btn-gold btn-sm"
                        disabled={ocupado === o.chave}
                        onClick={() => chamar(o, { acao: 'realizar', valor: Number(valor), data_realizada: dataReal })}
                      >
                        Confirmar
                      </button>
                      <button className="btn-outline btn-sm" onClick={() => setEditando(null)}>
                        Voltar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {aberto && (
                        <>
                          <button className="btn-gold btn-sm" disabled={ocupado === o.chave} onClick={() => abrirRealizar(o)}>
                            {o.tipo === 'entrada' ? 'Recebido' : 'Pago'}
                          </button>
                          <button
                            className="btn-outline btn-sm"
                            disabled={ocupado === o.chave}
                            title="Esta data não vai acontecer"
                            onClick={() => chamar(o, { acao: 'pular' })}
                          >
                            Pular
                          </button>
                        </>
                      )}
                      {!aberto && (
                        <button className="btn-outline btn-sm" disabled={ocupado === o.chave} onClick={() => chamar(o, { acao: 'desfazer' })}>
                          Desfazer
                        </button>
                      )}
                      {o.recorrente && aberto && (
                        <button
                          className="btn-outline btn-sm"
                          disabled={ocupado === o.chave}
                          title="A recorrência termina nesta data"
                          onClick={() => {
                            if (confirm(`Encerrar "${o.descricao}" em ${dataBR(o.data)}? As datas seguintes deixam de aparecer.`))
                              chamar(o, { acao: 'encerrar' })
                          }}
                        >
                          Encerrar aqui
                        </button>
                      )}
                      {!o.recorrente && (
                        <button
                          className="btn-outline btn-sm"
                          disabled={ocupado === o.chave}
                          onClick={() => {
                            if (confirm(`Excluir "${o.descricao}"?`)) chamar(o, {}, 'DELETE')
                          }}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

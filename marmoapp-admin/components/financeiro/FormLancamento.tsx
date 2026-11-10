'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIAS, hojeBR, RECORRENCIAS, type Recorrencia, type TipoLancamento } from '@/lib/financeiro'

interface Opcao {
  id: string
  nome: string
}

interface Props {
  clientes?: Opcao[]
  investimentos?: Opcao[]
  /** Fixa o cliente (página do cliente). */
  marmoraria?: Opcao
  /** Fixa o investimento (aba de marketing). */
  investimento?: Opcao
  tipoInicial?: TipoLancamento
  categoriaInicial?: string
  recorrenciaInicial?: Recorrencia
  descricaoInicial?: string
  titulo?: string
  aoSalvar?: () => void
}

// Formulário de novo lançamento: entrada ou saída, uma vez ou recorrente.
export default function FormLancamento({
  clientes = [],
  investimentos = [],
  marmoraria,
  investimento,
  tipoInicial = 'entrada',
  categoriaInicial,
  recorrenciaInicial = 'unica',
  descricaoInicial = '',
  titulo = 'Novo lançamento',
  aoSalvar,
}: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoLancamento>(tipoInicial)
  const [categoria, setCategoria] = useState(categoriaInicial ?? CATEGORIAS[tipoInicial][0].valor)
  const [descricao, setDescricao] = useState(descricaoInicial)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeBR())
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(recorrenciaInicial)
  const [fim, setFim] = useState('')
  const [jaRealizado, setJaRealizado] = useState(false)
  const [cliente, setCliente] = useState(marmoraria?.id ?? '')
  const [inv, setInv] = useState(investimento?.id ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function trocarTipo(t: TipoLancamento) {
    setTipo(t)
    setCategoria(CATEGORIAS[t][0].valor)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const r = await fetch('/api/financeiro/lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        categoria,
        descricao,
        valor: Number(valor),
        data_prevista: data,
        recorrencia,
        recorrencia_fim: recorrencia !== 'unica' && fim ? fim : null,
        status: recorrencia === 'unica' && jaRealizado ? 'realizado' : 'previsto',
        marmoraria_id: cliente || null,
        investimento_id: inv || null,
      }),
    })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) {
      setErro(j.error ?? 'Não foi possível salvar.')
      return
    }
    setDescricao(descricaoInicial)
    setValor('')
    setJaRealizado(false)
    router.refresh()
    aoSalvar?.()
  }

  return (
    <form onSubmit={salvar} className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold">
          {(['entrada', 'saida'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => trocarTipo(t)}
              className={`rounded-md px-3 py-1 ${tipo === t ? (t === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'text-gray-600'}`}
            >
              {t === 'entrada' ? 'Entrada' : 'Saída'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="rotulo">Descrição</span>
          <input className="campo" required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Mensalidade Real Pedras" />
        </label>
        <label>
          <span className="rotulo">Valor (R$)</span>
          <input className="campo" required type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1000,00" />
        </label>
        <label>
          <span className="rotulo">Categoria</span>
          <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS[tipo].map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">{recorrencia === 'unica' ? 'Data' : 'Primeira data'}</span>
          <input className="campo" required type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Repetição</span>
          <select className="campo" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}>
            {RECORRENCIAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        {recorrencia !== 'unica' ? (
          <label>
            <span className="rotulo">Até (opcional)</span>
            <input className="campo" type="date" value={fim} min={data} onChange={(e) => setFim(e.target.value)} />
          </label>
        ) : (
          <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={jaRealizado} onChange={(e) => setJaRealizado(e.target.checked)} className="h-4 w-4 accent-[#C9A84C]" />
            Já foi {tipo === 'entrada' ? 'recebido' : 'pago'}
          </label>
        )}
        {!marmoraria && clientes.length > 0 && (
          <label>
            <span className="rotulo">Cliente (opcional)</span>
            <select className="campo" value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {!investimento && investimentos.length > 0 && (
          <label>
            <span className="rotulo">Investimento de marketing</span>
            <select className="campo" value={inv} onChange={(e) => setInv(e.target.value)}>
              <option value="">—</option>
              {investimentos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="flex justify-end">
        <button className="btn-gold" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar lançamento'}
        </button>
      </div>
    </form>
  )
}

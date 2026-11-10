'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FormLancamento from './FormLancamento'
import TabelaOcorrencias from './TabelaOcorrencias'
import { brl, CANAIS, dataBR, hojeBR, type Ocorrencia } from '@/lib/financeiro'
import type { RetornoInvestimento } from '@/lib/financeiro-servidor'

const STATUS = [
  { valor: 'planejado', nome: 'Planejado' },
  { valor: 'ativo', nome: 'Rodando' },
  { valor: 'pausado', nome: 'Pausado' },
  { valor: 'encerrado', nome: 'Encerrado' },
]

// Investimentos de marketing: o que já foi gasto, o que ainda vai ser gasto
// e o que voltou em leads, diagnósticos e contratos (pela utm_campaign).
export default function PainelMarketing({ investimentos, gastos }: { investimentos: RetornoInvestimento[]; gastos: Ocorrencia[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState<string | null>(investimentos[0]?.id ?? null)
  const [novo, setNovo] = useState(investimentos.length === 0)
  const [f, setF] = useState({ nome: '', canal: 'meta', utm_campaign: '', inicio: hojeBR(), fim: '', orcamento: '', status: 'planejado' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const total = investimentos.reduce(
    (s, i) => ({
      investido: s.investido + i.investido,
      aInvestir: s.aInvestir + i.a_investir,
      leads: s.leads + i.leads,
      contratos: s.contratos + i.contratos,
      retorno: s.retorno + Math.max(i.receita_contratada_12m, i.receita_recebida),
    }),
    { investido: 0, aInvestir: 0, leads: 0, contratos: 0, retorno: 0 },
  )
  const roiTotal = total.investido > 0 ? (total.retorno - total.investido) / total.investido : null

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const r = await fetch('/api/financeiro/investimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, fim: f.fim || null, orcamento: f.orcamento || 0 }),
    })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) return setErro(j.error ?? 'Não foi possível salvar.')
    setNovo(false)
    setAberto(j.id)
    setF({ ...f, nome: '', utm_campaign: '', orcamento: '' })
    router.refresh()
  }

  async function mudarStatus(id: string, status: string) {
    await fetch(`/api/financeiro/investimentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function excluir(i: RetornoInvestimento) {
    if (!confirm(`Excluir "${i.nome}"? Os gastos lançados continuam no financeiro, só sem o vínculo com a campanha.`)) return
    await fetch(`/api/financeiro/investimentos/${i.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Investido', brl(total.investido), 'gastos já pagos'],
          ['A investir', brl(total.aInvestir), 'gastos previstos'],
          ['Leads', String(total.leads), 'pela utm_campaign'],
          ['Contratos', String(total.contratos), 'assinados'],
          ['ROI', roiTotal == null ? '—' : `${Math.round(roiTotal * 100)}%`, 'receita de 12 meses vs. investido'],
        ].map(([t, v, s]) => (
          <div key={t} className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t}</p>
            <p className="mt-2 font-serif text-[28px] font-bold leading-tight text-gray-900">{v}</p>
            <p className="mt-1 text-sm text-gray-500">{s}</p>
          </div>
        ))}
      </div>

      <div className="card p-5 text-sm text-gray-600">
        <b className="text-gray-900">Como o retorno é calculado.</b> Cada investimento tem uma <code className="rounded bg-page px-1">utm_campaign</code>,
        a mesma do link do anúncio. Os leads que chegam pelo formulário com essa UTM são contados aqui, junto com os diagnósticos e os contratos
        assinados. O retorno é o valor de 12 meses dos contratos (mensalidade × 12 + implantação) ou o que já entrou ligado à campanha, o que for
        maior. ROI = (retorno − investido) ÷ investido.
      </div>

      {novo ? (
        <form onSubmit={criar} className="card space-y-4 p-5">
          <h3 className="text-sm font-semibold text-gray-900">Novo investimento</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="rotulo">Nome</span>
              <input className="campo" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Meta — MarmorarIA novembro" />
            </label>
            <label>
              <span className="rotulo">Canal</span>
              <select className="campo" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
                {CANAIS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="rotulo">utm_campaign</span>
              <input className="campo font-mono" value={f.utm_campaign} onChange={(e) => setF({ ...f, utm_campaign: e.target.value })} placeholder="marmoraria-ia-nov26" />
            </label>
            <label>
              <span className="rotulo">Início</span>
              <input className="campo" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Fim (opcional)</span>
              <input className="campo" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Orçamento total (R$)</span>
              <input className="campo" type="number" step="0.01" min="0" value={f.orcamento} onChange={(e) => setF({ ...f, orcamento: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Situação</span>
              <select className="campo" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                {STATUS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Depois de criar, lance os gastos (por exemplo R$ 20 por dia, ou o total da fatura do Meta) em &quot;Registrar gasto&quot;.
          </p>
          {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-2">
            {investimentos.length > 0 && (
              <button type="button" className="btn-outline" onClick={() => setNovo(false)}>
                Cancelar
              </button>
            )}
            <button className="btn-gold" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Criar investimento'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button className="btn-gold" onClick={() => setNovo(true)}>
            + Novo investimento
          </button>
        </div>
      )}

      {investimentos.map((i) => {
        const meus = gastos.filter((g) => g.investimento_id === i.id)
        const pct = i.orcamento > 0 ? Math.min(100, (i.investido / i.orcamento) * 100) : null
        return (
          <div key={i.id} className="card">
            <button className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left" onClick={() => setAberto(aberto === i.id ? null : i.id)}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{i.nome}</div>
                <div className="text-xs text-gray-500">
                  {CANAIS.find((c) => c.valor === i.canal)?.nome ?? i.canal}
                  {i.utm_campaign && <span className="ml-2 font-mono">{i.utm_campaign}</span>}
                  {i.inicio && ` · desde ${dataBR(i.inicio)}`}
                  {i.fim && ` até ${dataBR(i.fim)}`}
                </div>
              </div>
              {[
                ['Investido', brl(i.investido)],
                ['Leads', String(i.leads)],
                ['Custo/lead', i.custo_por_lead != null ? brl(i.custo_por_lead) : '—'],
                ['Diagnósticos', String(i.diagnosticos)],
                ['Contratos', String(i.contratos)],
                ['CAC', i.cac != null ? brl(i.cac) : '—'],
              ].map(([t, v]) => (
                <div key={t} className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t}</div>
                  <div className="text-sm font-semibold text-gray-900">{v}</div>
                </div>
              ))}
              <div className="w-20 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">ROI</div>
                <div className={`font-serif text-lg font-bold ${i.roi == null ? 'text-gray-400' : i.roi >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {i.roi != null ? `${Math.round(i.roi * 100)}%` : '—'}
                </div>
              </div>
            </button>

            {aberto === i.id && (
              <div className="space-y-4 border-t border-gray-200 p-5">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <span className="text-gray-500">Situação</span>
                    <select className="campo w-36" value={i.status} onChange={(e) => mudarStatus(i.id, e.target.value)}>
                      {STATUS.map((s) => (
                        <option key={s.valor} value={s.valor}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pct != null && (
                    <span className="flex items-center gap-2 text-gray-600">
                      Orçamento: {brl(i.investido)} de {brl(i.orcamento)}
                      <span className="inline-block h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                        <span className="block h-full bg-gold" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  )}
                  <span className="text-gray-600">
                    Retorno: {brl(Math.max(i.receita_contratada_12m, i.receita_recebida))}
                    {i.receita_recebida > 0 && ` (${brl(i.receita_recebida)} já recebido)`}
                  </span>
                  <button className="btn-outline btn-sm ml-auto" onClick={() => excluir(i)}>
                    Excluir investimento
                  </button>
                </div>

                <FormLancamento
                  titulo="Registrar gasto desta campanha"
                  investimento={{ id: i.id, nome: i.nome }}
                  tipoInicial="saida"
                  categoriaInicial="marketing"
                  descricaoInicial={`Anúncios — ${i.nome}`}
                />

                <div className="card">
                  <TabelaOcorrencias ocorrencias={meus} mostrarCliente={false} vazio="Nenhum gasto lançado para este investimento." />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

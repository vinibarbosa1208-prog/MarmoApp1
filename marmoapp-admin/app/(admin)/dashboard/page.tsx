import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import MetricCard from '@/components/MetricCard'
import Header from '@/components/Header'
import type { Marmoraria, Orcamento, OrcamentosPorDia, ChurnRisk } from '@/lib/types'
import { PLANO_PRECOS as PRECOS } from '@/lib/types'
import { format, subDays, startOfDay, parseISO } from 'date-fns'
import OrcamentosChartLazy from '@/components/charts/OrcamentosChartLazy'

async function fetchMetrics() {
  const now = new Date()
  const hoje = startOfDay(now).toISOString()
  const semanaAtras = subDays(now, 7).toISOString()
  const trintaDiasAtras = subDays(now, 30).toISOString()

  const [marmorariasRes, orcamentosHojeRes, orcamentosSemanaRes, orcamentos30Res] =
    await Promise.all([
      supabaseAdmin.from('marmorarias').select('id, nome, plano, trial_expira, setup_concluido'),
      supabaseAdmin
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hoje),
      supabaseAdmin
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', semanaAtras),
      supabaseAdmin
        .from('orcamentos')
        .select('created_at')
        .gte('created_at', trintaDiasAtras)
        .order('created_at'),
    ])

  const marmorarias = (marmorariasRes.data ?? []) as Marmoraria[]

  const mrr = marmorarias.reduce((acc, m) => {
    const preco = m.plano ? (PRECOS[m.plano] ?? 0) : 0
    return acc + preco
  }, 0)

  const clientesPagantes = marmorarias.filter(
    (m) => m.plano && !['trial', null].includes(m.plano)
  ).length

  const trialsAtivos = marmorarias.filter(
    (m) => m.plano === 'trial' && m.trial_expira && new Date(m.trial_expira) > now
  ).length

  const totalCadastros = marmorarias.length
  const setupConcluido = marmorarias.filter((m) => m.setup_concluido).length
  const taxaActivation = totalCadastros > 0 ? Math.round((setupConcluido / totalCadastros) * 100) : 0

  // Group orcamentos by day for chart
  const countByDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(now, i), 'yyyy-MM-dd')
    countByDay[d] = 0
  }
  for (const o of orcamentos30Res.data ?? []) {
    const d = (o as { created_at: string }).created_at.slice(0, 10)
    if (d in countByDay) countByDay[d]++
  }
  const orcamentosPorDia: OrcamentosPorDia[] = Object.entries(countByDay).map(([data, total]) => ({
    data,
    total,
  }))

  return {
    mrr,
    arr: mrr * 12,
    clientesPagantes,
    trialsAtivos,
    totalCadastros,
    taxaActivation,
    orcamentosHoje: orcamentosHojeRes.count ?? 0,
    orcamentosSemana: orcamentosSemanaRes.count ?? 0,
    orcamentosPorDia,
  }
}

async function fetchChurnRisk(): Promise<ChurnRisk[]> {
  const [marmorariasRes, orcamentosRes] = await Promise.all([
    supabaseAdmin
      .from('marmorarias')
      .select('id, nome, plano')
      .not('plano', 'is', null)
      .neq('plano', 'trial'),
    supabaseAdmin
      .from('orcamentos')
      .select('marmoraria_id, created_at')
      .order('created_at', { ascending: false }),
  ])

  const marmorarias = marmorariasRes.data ?? []
  const orcamentos = orcamentosRes.data ?? []

  const latestByMarmoraria: Record<string, string> = {}
  for (const o of orcamentos as Orcamento[]) {
    if (!latestByMarmoraria[o.marmoraria_id]) {
      latestByMarmoraria[o.marmoraria_id] = o.created_at
    }
  }

  const catorze = subDays(new Date(), 14)

  const churn: ChurnRisk[] = marmorarias
    .map((m) => {
      const ultimo = latestByMarmoraria[m.id] ?? null
      const dias = ultimo
        ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000)
        : null
      return { id: m.id, nome: m.nome, plano: m.plano, ultimo_orcamento: ultimo, dias_sem_uso: dias }
    })
    .filter((m) => !m.ultimo_orcamento || new Date(m.ultimo_orcamento) < catorze)
    .sort((a, b) => (b.dias_sem_uso ?? 9999) - (a.dias_sem_uso ?? 9999))
    .slice(0, 10)

  return churn
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default async function DashboardPage() {
  await requireAdminAuth()
  const [metrics, churnRisk] = await Promise.all([fetchMetrics(), fetchChurnRisk()])

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" subtitle="Visão geral em tempo real" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Linha 1 — Receita */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Receita
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard title="MRR Atual" value={formatMoney(metrics.mrr)} accent="green" />
            <MetricCard title="ARR" value={formatMoney(metrics.arr)} accent="green" />
            <MetricCard
              title="Clientes Pagantes"
              value={metrics.clientesPagantes}
              accent="blue"
            />
            <MetricCard title="Trials Ativos" value={metrics.trialsAtivos} accent="yellow" />
          </div>
        </div>

        {/* Linha 2 — Produto */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Produto
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard title="Total Cadastros" value={metrics.totalCadastros} accent="purple" />
            <MetricCard
              title="Taxa Activation"
              value={`${metrics.taxaActivation}%`}
              accent="purple"
              subtitle="com setup concluído"
            />
            <MetricCard title="Orçamentos Hoje" value={metrics.orcamentosHoje} accent="blue" />
            <MetricCard
              title="Orçamentos Semana"
              value={metrics.orcamentosSemana}
              accent="blue"
            />
          </div>
        </div>

        {/* Gráfico */}
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Orçamentos — últimos 30 dias</h2>
          <OrcamentosChartLazy data={metrics.orcamentosPorDia} />
        </div>

        {/* Churn Risk */}
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Clientes em risco de churn
            <span className="ml-2 text-xs font-normal text-slate-500">
              sem orçamento há &gt;14 dias
            </span>
          </h2>

          {churnRisk.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum cliente em risco no momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-2 text-left text-xs text-slate-500 font-medium">Marmoraria</th>
                    <th className="pb-2 text-left text-xs text-slate-500 font-medium">Plano</th>
                    <th className="pb-2 text-left text-xs text-slate-500 font-medium">Último orçamento</th>
                    <th className="pb-2 text-left text-xs text-slate-500 font-medium">Dias sem uso</th>
                    <th className="pb-2 text-left text-xs text-slate-500 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {churnRisk.map((c) => {
                    const msg = encodeURIComponent(
                      `Olá! Sou da equipe MarmoApp. Vi que vocês não criaram novos orçamentos recentemente. Posso ajudar com algo?`
                    )
                    return (
                      <tr key={c.id} className="py-2">
                        <td className="py-2.5 text-white font-medium">{c.nome}</td>
                        <td className="py-2.5">
                          <span className="text-slate-400 capitalize">{c.plano ?? '—'}</span>
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {c.ultimo_orcamento
                            ? format(parseISO(c.ultimo_orcamento), 'dd/MM/yyyy')
                            : 'Nunca'}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`font-semibold ${
                              (c.dias_sem_uso ?? 999) > 30
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}
                          >
                            {c.dias_sem_uso !== null ? `${c.dias_sem_uso}d` : '∞'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <a
                            href={`https://wa.me/?text=${msg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600"
                          >
                            Contatar
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

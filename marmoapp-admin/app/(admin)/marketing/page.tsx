import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import MarketingMetricasForm from '@/components/MarketingMetricasForm'
import { subDays, startOfDay, getISOWeek, format } from 'date-fns'
import Link from 'next/link'
import { carregarInvestimentosComRetorno, carregarLancamentos } from '@/lib/financeiro-servidor'
import { brl } from '@/lib/financeiro'

export default async function MarketingPage() {
  await requireAdminAuth()

  const now = new Date()
  const semanaInicio = startOfDay(subDays(now, 7)).toISOString()
  const ciclo = ((getISOWeek(now) - 1) % 4) + 1

  const temasRotativos: Record<number, string> = {
    1: 'DOR FINANCEIRA — "Quanto você perde por mês sem controle de margem?"',
    2: 'SOLUÇÃO — "Como o MarmoApp calcula orçamento em 2 minutos"',
    3: 'PROVA SOCIAL — "Como a Real Pedras (Arujá-SP) organiza a produção"',
    4: 'PRODUTO — "O que é o Agente Antônio e como funciona"',
  }

  const [leadsSemanaRes, leadsRes, diagRes, enviadosRes, assinadosRes, ultimaMetricaRes, lancamentos] = await Promise.all([
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', semanaInicio),
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('diagnosticos').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('contratos').select('id', { count: 'exact', head: true }).in('status', ['enviado', 'assinado']),
    supabaseAdmin.from('contratos').select('id', { count: 'exact', head: true }).eq('status', 'assinado'),
    supabaseAdmin
      .from('marketing_metricas')
      .select('*')
      .order('semana_ref', { ascending: false })
      .limit(1)
      .maybeSingle(),
    carregarLancamentos().catch(() => []),
  ])
  const investimentos = await carregarInvestimentosComRetorno(lancamentos).catch(() => [])

  const leadsNaSemana = leadsSemanaRes.count ?? 0
  const funil = [
    { label: 'Leads', value: leadsRes.count ?? 0, note: 'formulário, landing e calls' },
    { label: 'Diagnósticos', value: diagRes.count ?? 0, note: 'calls registradas' },
    { label: 'Propostas', value: enviadosRes.count ?? 0, note: 'contratos enviados' },
    { label: 'Fechados', value: assinadosRes.count ?? 0, note: 'contratos assinados' },
  ]

  const metrica = ultimaMetricaRes.data
  const temDadosReais = !!metrica

  const diasDaSemana = ['SEG', 'TER', 'QUA', 'QUI']
  const temasSemana = [
    'Carrossel 1 — Educativo (dor + solução)',
    'Carrossel 2 — Prova social ou recurso',
    'Carrossel 3 — Educativo do setor',
    'Carrossel 4 — Conversão direta',
  ]

  return (
    <div className="flex flex-col">
      <Header
        title="Marketing"
        subtitle={`Ciclo ${ciclo}/4 — ${temasRotativos[ciclo]}`}
      />

      <main className="p-6 space-y-6">

        {/* Seção 1 — Métricas da semana */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Métricas da semana
              </h2>
              {temDadosReais && (
                <span className="text-xs text-gray-400">
                  semana de {format(new Date(metrica.semana_ref + 'T12:00:00'), 'dd/MM/yyyy')}
                </span>
              )}
            </div>
            <MarketingMetricasForm
              defaultValues={
                metrica
                  ? {
                      alcance_total: metrica.alcance_total,
                      novos_seguidores: metrica.novos_seguidores,
                      engajamento_medio: Number(metrica.engajamento_medio),
                      cliques_bio: metrica.cliques_bio,
                      leads_gerados: metrica.leads_gerados,
                    }
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard
              title="Alcance total"
              value={temDadosReais ? metrica.alcance_total.toLocaleString('pt-BR') : '—'}
              accent="blue"
              subtitle={temDadosReais ? 'Instagram orgânico' : 'sem dados ainda'}
            />
            <MetricCard
              title="Novos seguidores"
              value={temDadosReais ? `+${metrica.novos_seguidores}` : '—'}
              accent="green"
              subtitle={temDadosReais ? 'na semana' : 'sem dados ainda'}
            />
            <MetricCard
              title="Engajamento médio"
              value={temDadosReais ? `${Number(metrica.engajamento_medio).toFixed(1)}%` : '—'}
              accent="purple"
              subtitle={temDadosReais ? 'meta: >4%' : 'sem dados ainda'}
            />
            <MetricCard
              title="Cliques no link"
              value={temDadosReais ? metrica.cliques_bio : '—'}
              accent="yellow"
              subtitle={temDadosReais ? 'link da bio' : 'sem dados ainda'}
            />
            <MetricCard
              title="Leads gerados"
              value={temDadosReais ? metrica.leads_gerados : leadsNaSemana}
              accent="blue"
              subtitle={temDadosReais ? 'inserido manualmente' : 'últimos 7 dias'}
            />
          </div>

          {!temDadosReais && (
            <p className="mt-2 text-xs text-gray-400">
              Clique em &quot;Inserir métricas da semana&quot; para adicionar dados do Instagram Insights.
            </p>
          )}
        </section>

        {/* Seção 2 — Calendário editorial */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Calendário editorial — semana {ciclo}
            </h2>
            <a
              href="https://claude.ai/code"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Gerar conteúdo da semana →
            </a>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Dia', 'Formato', 'Tema', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {diasDaSemana.map((dia, i) => (
                  <tr key={dia} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700">{dia}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">Carrossel</td>
                    <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">{temasSemana[i]}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Pendente
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            No Claude Code: <span className="font-mono text-gray-500">&quot;Aja como marketing-editorial. Estamos na semana {ciclo} do ciclo.&quot;</span>
          </p>
        </section>

        {/* Seção 3 — Investimentos e retorno */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Investimentos em marketing e retorno
            </h2>
            <Link href="/financeiro?aba=marketing" className="btn-outline btn-sm">
              Gerenciar no Financeiro →
            </Link>
          </div>
          <div className="card overflow-x-auto">
            {investimentos.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                Nenhum investimento cadastrado. Cadastre a campanha no Financeiro, com a mesma utm_campaign do anúncio,
                para ver aqui quanto foi gasto, quantos leads vieram e o retorno.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Investimento', 'Investido', 'Leads', 'Custo/lead', 'Fechados', 'ROI'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {investimentos.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.nome}
                        {c.utm_campaign && <span className="ml-2 font-mono text-[11px] text-gray-400">{c.utm_campaign}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{brl(c.investido)}</td>
                      <td className="px-4 py-3 text-gray-700">{c.leads}</td>
                      <td className="px-4 py-3 text-gray-700">{c.custo_por_lead != null ? brl(c.custo_por_lead) : '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{c.contratos}</td>
                      <td className={`px-4 py-3 font-semibold ${c.roi == null ? 'text-gray-400' : c.roi >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {c.roi != null ? `${Math.round(c.roi * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Seção 4 — Funil comercial (dados reais) */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Funil comercial</h2>
          <div className="card p-6">
            <div className="flex items-center gap-0">
              {funil.map((step, i, arr) => (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex-1">
                    <div className={`rounded-xl p-4 text-center ${i === arr.length - 1 ? 'bg-gold' : 'bg-page'}`}>
                      <div className="font-serif text-2xl font-bold text-gray-900">{step.value}</div>
                      <div className="text-xs font-semibold text-gray-800 mt-1">{step.label}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{step.note}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="text-center mt-1 text-xs text-gray-400">
                        {step.value > 0 ? `${((arr[i + 1].value / step.value) * 100).toFixed(0)}% seguem` : '—'}
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && <div className="text-gray-400 text-lg px-2 flex-shrink-0">→</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

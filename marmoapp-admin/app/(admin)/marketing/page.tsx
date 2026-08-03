import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import MarketingMetricasForm from '@/components/MarketingMetricasForm'
import { subDays, startOfDay, getISOWeek, format } from 'date-fns'

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

  const [leadsRes, trialsRes, pagantesRes, totalRes, ultimaMetricaRes] = await Promise.all([
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', semanaInicio),
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true })
      .eq('plano', 'trial'),
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true })
      .not('plano', 'is', null)
      .neq('plano', 'trial'),
    supabaseAdmin
      .from('marmorarias')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('marketing_metricas')
      .select('*')
      .order('semana_ref', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const leadsNaSemana = leadsRes.count ?? 0
  const trialsAtivos = trialsRes.count ?? 0
  const pagantes = pagantesRes.count ?? 0
  const total = totalRes.count ?? 0
  const visitantesEstimado = Math.round(leadsNaSemana * 18)
  const taxaConversao = total > 0 ? ((pagantes / total) * 100).toFixed(1) : '0'

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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Métricas da semana
              </h2>
              {temDadosReais && (
                <span className="text-xs text-slate-600">
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
            <p className="mt-2 text-xs text-slate-600">
              Clique em "Inserir métricas da semana" para adicionar dados do Instagram Insights.
            </p>
          )}
        </section>

        {/* Seção 2 — Calendário editorial */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Calendário editorial — semana {ciclo}
            </h2>
            <a
              href="https://claude.ai/code"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Gerar conteúdo da semana →
            </a>
          </div>
          <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Dia', 'Formato', 'Tema', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {diasDaSemana.map((dia, i) => (
                  <tr key={dia} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-semibold text-slate-300">{dia}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">Carrossel</td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-xs">{temasSemana[i]}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                        Pendente
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            No Claude Code: <span className="font-mono text-slate-500">"Aja como marketing-editorial. Estamos na semana {ciclo} do ciclo."</span>
          </p>
        </section>

        {/* Seção 3 — Campanhas Meta Ads */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Campanhas Meta Ads
            </h2>
            <a
              href="https://business.facebook.com/adsmanager"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Ver no Ads Manager →
            </a>
          </div>
          <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Campanha', 'Objetivo', 'Orçamento/dia', 'CPL meta', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {[
                  { nome: 'Awareness SP/MG/PR/RJ', objetivo: 'Alcance', orcamento: 'R$15', cpl: '—', status: 'Configurar' },
                  { nome: 'Conversão — Leads', objetivo: 'Tráfego', orcamento: 'R$25', cpl: '<R$15', status: 'Configurar' },
                  { nome: 'Remarketing 30d', objetivo: 'Conversão', orcamento: 'R$10', cpl: '<R$20', status: 'Configurar' },
                ].map((c) => (
                  <tr key={c.nome} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-300 font-medium text-xs">{c.nome}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.objetivo}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.orcamento}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{c.cpl}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-amber-900/40 border border-amber-800 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-600">
              No Claude Code: <span className="font-mono text-slate-500">"Aja como marketing-ads. Quero criar uma campanha de leads."</span>
            </div>
          </div>
        </section>

        {/* Seção 4 — Pipeline de leads */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Pipeline de leads
          </h2>
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
            <div className="flex items-center gap-0">
              {[
                { label: 'Visitantes', value: visitantesEstimado, color: 'bg-slate-600', note: 'estimado' },
                { label: 'Leads', value: total, color: 'bg-blue-700', note: 'cadastros total' },
                { label: 'Trials', value: trialsAtivos, color: 'bg-indigo-600', note: 'ativos agora' },
                { label: 'Pagantes', value: pagantes, color: 'bg-green-700', note: 'clientes ativos' },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex-1">
                    <div className={`${step.color} rounded-xl p-4 text-center`}>
                      <div className="text-2xl font-bold text-white">{step.value}</div>
                      <div className="text-xs font-semibold text-white/80 mt-1">{step.label}</div>
                      <div className="text-xs text-white/50 mt-0.5">{step.note}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="text-center mt-1 text-xs text-slate-600">
                        {i === 0
                          ? `${total > 0 && visitantesEstimado > 0 ? ((total / visitantesEstimado) * 100).toFixed(1) : '?'}%`
                          : i === 1
                          ? `${total > 0 ? ((trialsAtivos / total) * 100).toFixed(1) : '0'}%`
                          : `${trialsAtivos > 0 ? ((pagantes / (trialsAtivos + pagantes)) * 100).toFixed(1) : '0'}%`}
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-slate-600 text-lg px-2 flex-shrink-0">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

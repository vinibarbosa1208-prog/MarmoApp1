import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { configMeta } from '@/lib/meta'
import { brl, dataBR, hojeBR, somarDias } from '@/lib/financeiro'
import BotaoSincronizar from './BotaoSincronizar'
import VinculoCampanha from './VinculoCampanha'

const STATUS: Record<string, { nome: string; cor: string }> = {
  ACTIVE: { nome: 'Rodando', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSED: { nome: 'Pausada', cor: 'bg-gray-100 text-gray-600 border-gray-200' },
  CAMPAIGN_PAUSED: { nome: 'Pausada', cor: 'bg-gray-100 text-gray-600 border-gray-200' },
  ARCHIVED: { nome: 'Arquivada', cor: 'bg-gray-50 text-gray-400 border-gray-200' },
  DELETED: { nome: 'Excluída', cor: 'bg-gray-50 text-gray-400 border-gray-200' },
  IN_PROCESS: { nome: 'Em análise', cor: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  WITH_ISSUES: { nome: 'Com problema', cor: 'bg-red-50 text-red-700 border-red-200' },
}

const num = (n: number) => n.toLocaleString('pt-BR')

// Seção "Meta Ads" da tela de Marketing: números que vêm direto da conta de anúncios,
// ao lado dos leads que de fato chegaram pelo formulário (utm_source=meta).
export default async function MetaAdsPainel() {
  const { pronto, conta } = configMeta()
  const hoje = hojeBR()
  const d30 = somarDias(hoje, -29)
  const d7 = somarDias(hoje, -6)

  const [campRes, insRes, syncRes, invRes, leadsRes] = await Promise.all([
    supabaseAdmin.from('admin_meta_campanhas').select('campaign_id, nome, status, orcamento_diario, investimento_id'),
    supabaseAdmin.from('admin_meta_insights').select('data, campaign_id, gasto, impressoes, cliques_link, leads_meta, conversas').gte('data', d30),
    supabaseAdmin.from('admin_meta_sync').select('iniciado_em, ok, mensagem, origem').order('iniciado_em', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('admin_fin_investimentos').select('id, nome, utm_campaign').order('created_at', { ascending: false }),
    supabaseAdmin.from('leads').select('created_at, utm_campaign').eq('utm_source', 'meta').gte('created_at', `${d30}T03:00:00Z`),
  ])

  const campanhas = campRes.data ?? []
  const insights = (insRes.data ?? []).map((i) => ({ ...i, gasto: Number(i.gasto) }))
  const sync = syncRes.data
  const investimentos = (invRes.data ?? []).map((i) => ({ id: i.id as string, nome: i.nome as string, utm: (i.utm_campaign as string | null) ?? null }))
  const leads = leadsRes.data ?? []

  const soma = (lista: typeof insights, k: 'gasto' | 'impressoes' | 'cliques_link' | 'leads_meta' | 'conversas') =>
    lista.reduce((s, i) => s + Number(i[k] ?? 0), 0)
  const ult7 = insights.filter((i) => String(i.data) >= d7)
  const gasto30 = soma(insights, 'gasto')
  const cliques30 = soma(insights, 'cliques_link')
  const leadsMeta30 = soma(insights, 'leads_meta')
  const leadsForm30 = leads.length

  // gasto por dia (30 dias) para o gráfico de barras
  const porDia = Array.from({ length: 30 }, (_, k) => {
    const d = somarDias(d30, k)
    return { d, v: insights.filter((i) => String(i.data) === d).reduce((s, i) => s + i.gasto, 0) }
  })
  const maior = Math.max(1, ...porDia.map((x) => x.v))

  const linhas = campanhas
    .map((c) => {
      const meus = insights.filter((i) => i.campaign_id === c.campaign_id)
      const inv = investimentos.find((i) => i.id === c.investimento_id)
      const leadsForm = inv?.utm ? leads.filter((l) => l.utm_campaign === inv.utm).length : null
      const gasto = soma(meus, 'gasto')
      const cl = soma(meus, 'cliques_link')
      return {
        ...c,
        gasto,
        impressoes: soma(meus, 'impressoes'),
        cliques: cl,
        leadsMeta: soma(meus, 'leads_meta'),
        leadsForm,
        cpc: cl ? gasto / cl : null,
      }
    })
    .filter((c) => c.gasto > 0 || c.status === 'ACTIVE')
    .sort((a, b) => b.gasto - a.gasto)

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Meta Ads · Facebook e Instagram</h2>
          <p className="text-xs text-gray-400">
            {pronto
              ? sync
                ? `Última atualização: ${new Date(sync.iniciado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (${sync.origem === 'cron' ? 'automática' : 'manual'})${sync.ok ? '' : ' · falhou'}`
                : 'Conectado. Clique em "Atualizar agora" para trazer os números.'
              : 'Ainda não conectado.'}
            {pronto && ' · atualiza sozinho todo dia às 7h'}
          </p>
        </div>
        <BotaoSincronizar desabilitado={!pronto} />
      </div>

      {!pronto && (
        <div className="card space-y-2 p-5 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Para conectar a conta de anúncios:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>No Gerenciador de Negócios do Meta: Configurações do negócio → Usuários do sistema → Adicionar (função: funcionário).</li>
            <li>Em &quot;Atribuir ativos&quot;, dê acesso à conta de anúncios {conta ? <b>act_{conta}</b> : 'do MarmoApp'} com a permissão &quot;Ver desempenho&quot;.</li>
            <li>Clique em &quot;Gerar token&quot;, escolha o app, marque <b>ads_read</b> e validade &quot;Nunca&quot;.</li>
            <li>
              Na Vercel (projeto marmoapp-admin → Settings → Environment Variables), crie <code className="rounded bg-page px-1">META_ADS_TOKEN</code> com
              esse token{conta ? '' : <> e <code className="rounded bg-page px-1">META_AD_ACCOUNT_ID</code> com o número da conta</>} e publique de novo.
            </li>
          </ol>
        </div>
      )}

      {sync && !sync.ok && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Última tentativa falhou: {sync.mensagem}</p>
      )}

      {pronto && insights.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {[
              ['Gasto · 7 dias', brl(soma(ult7, 'gasto'))],
              ['Gasto · 30 dias', brl(gasto30)],
              ['Cliques no link · 30d', num(cliques30)],
              ['Custo por clique', cliques30 ? brl(gasto30 / cliques30) : '—'],
              ['Leads no formulário · 30d', `${leadsForm30}${leadsMeta30 ? ` (Meta: ${leadsMeta30})` : ''}`],
              ['Custo por lead', leadsForm30 ? brl(gasto30 / leadsForm30) : '—'],
            ].map(([t, v]) => (
              <div key={t} className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t}</p>
                <p className="mt-2 font-serif text-2xl font-bold text-gray-900">{v}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-gray-900">Gasto por dia · últimos 30 dias</p>
            <div className="flex h-32 items-end gap-1">
              {porDia.map((x) => (
                <div key={x.d} className="group relative flex-1">
                  <div className="rounded-t bg-gold" style={{ height: `${Math.max(x.v > 0 ? 3 : 0, (x.v / maior) * 120)}px` }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[11px] text-white group-hover:block">
                    {dataBR(x.d)} · {brl(x.v)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span>{dataBR(d30)}</span>
              <span>{dataBR(hoje)}</span>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Campanha', 'Situação', 'Gasto 30d', 'Impressões', 'Cliques no link', 'Custo/clique', 'Leads (Meta / formulário)', 'Investimento no Financeiro'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhas.map((c) => {
                  const st = STATUS[c.status ?? ''] ?? { nome: c.status ?? '—', cor: 'bg-gray-100 text-gray-600 border-gray-200' }
                  return (
                    <tr key={c.campaign_id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.nome}
                        {c.orcamento_diario != null && <span className="block text-xs text-gray-400">{brl(Number(c.orcamento_diario))}/dia</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cor}`}>{st.nome}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{brl(c.gasto)}</td>
                      <td className="px-4 py-3 text-gray-700">{num(c.impressoes)}</td>
                      <td className="px-4 py-3 text-gray-700">{num(c.cliques)}</td>
                      <td className="px-4 py-3 text-gray-700">{c.cpc != null ? brl(c.cpc) : '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.leadsMeta} / {c.leadsForm ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <VinculoCampanha campaignId={c.campaign_id} atual={c.investimento_id} investimentos={investimentos} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              Ligue cada campanha a um investimento (com a mesma utm_campaign do anúncio): o gasto do mês entra sozinho no{' '}
              <Link href="/financeiro?aba=marketing" className="text-gold-dk hover:underline">
                Financeiro
              </Link>{' '}
              e o ROI passa a usar o valor real cobrado pelo Meta. &quot;Formulário&quot; conta os leads que chegaram com essa utm_campaign.
            </p>
          </div>
        </div>
      )}

      {pronto && insights.length === 0 && sync?.ok && (
        <p className="card p-5 text-sm text-gray-500">Nenhum gasto nos últimos 30 dias nessa conta de anúncios.</p>
      )}
    </section>
  )
}

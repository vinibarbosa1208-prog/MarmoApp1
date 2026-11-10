import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import MetricCard from '@/components/MetricCard'
import Header from '@/components/Header'
import Link from 'next/link'
import type { OrcamentosPorDia } from '@/lib/types'
import { format, subDays, startOfDay } from 'date-fns'
import OrcamentosChartLazy from '@/components/charts/OrcamentosChartLazy'
import { carregarClassificacoes, carregarLancamentos, idsForaDosNumeros } from '@/lib/financeiro-servidor'
import { brl, dataBR, expandir, hojeBR, receitaRecorrenteMensal, somarDias } from '@/lib/financeiro'

export const metadata = { title: 'Dashboard' }

// Tudo aqui vem do banco. Contas de teste e internas ficam fora dos números.
async function carregar() {
  const now = new Date()
  const hoje = hojeBR()
  const inicioMes = hoje.slice(0, 8) + '01'
  const em30 = somarDias(hoje, 30)

  const [classificacoes, lancamentos, marmRes, orc30Res, leads7Res, diagRes, aguardandoRes] = await Promise.all([
    carregarClassificacoes(),
    carregarLancamentos(),
    supabaseAdmin.from('marmorarias').select('id, nome'),
    supabaseAdmin.from('orcamentos').select('marmoraria_id, created_at').gte('created_at', subDays(now, 30).toISOString()),
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', subDays(now, 7).toISOString()),
    supabaseAdmin.from('diagnosticos').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('contratos').select('id', { count: 'exact', head: true }).eq('status', 'enviado'),
  ])

  const fora = idsForaDosNumeros(classificacoes)
  const marmorarias = (marmRes.data ?? []).filter((m) => !fora.has(m.id))
  const nomes = Object.fromEntries((marmRes.data ?? []).map((m) => [m.id, m.nome as string]))
  const contratantes = marmorarias.filter((m) => classificacoes[m.id] === 'contratante')
  const cadastros = marmorarias.filter((m) => (classificacoes[m.id] ?? 'cadastro') === 'cadastro')

  const oc = expandir(lancamentos, somarDias(hoje, -120), em30, hoje)
  const soma = (f: (o: (typeof oc)[number]) => boolean) => oc.filter(f).reduce((s, o) => s + o.valor, 0)
  const recebidoMes = soma((o) => o.tipo === 'entrada' && o.status === 'realizado' && (o.data_realizada ?? o.data) >= inicioMes)
  const aberto = (o: (typeof oc)[number]) => o.status === 'previsto' || o.status === 'atrasado'
  const entra30 = soma((o) => o.tipo === 'entrada' && aberto(o) && o.data <= em30)
  const sai30 = soma((o) => o.tipo === 'saida' && aberto(o) && o.data <= em30)
  const atrasados = oc.filter((o) => o.tipo === 'entrada' && o.status === 'atrasado')
  const marketingMes = soma(
    (o) => o.tipo === 'saida' && o.status === 'realizado' && o.categoria === 'marketing' && (o.data_realizada ?? o.data) >= inicioMes,
  )
  const proximos = oc.filter((o) => o.tipo === 'entrada' && o.status === 'previsto' && o.data >= hoje).slice(0, 6)

  const orcamentos = (orc30Res.data ?? []).filter((o) => !fora.has(o.marmoraria_id as string))
  const inicioHoje = startOfDay(now).toISOString()
  const semana = subDays(now, 7).toISOString()
  const countByDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) countByDay[format(subDays(now, i), 'yyyy-MM-dd')] = 0
  for (const o of orcamentos) {
    const d = (o.created_at as string).slice(0, 10)
    if (d in countByDay) countByDay[d]++
  }
  const orcamentosPorDia: OrcamentosPorDia[] = Object.entries(countByDay).map(([data, total]) => ({ data, total }))

  // risco de churn: contratantes sem orçamento há mais de 14 dias
  const ultimoPor: Record<string, string> = {}
  for (const o of orcamentos) {
    const id = o.marmoraria_id as string
    if (!ultimoPor[id] || (o.created_at as string) > ultimoPor[id]) ultimoPor[id] = o.created_at as string
  }
  const risco = contratantes.filter((m) => !ultimoPor[m.id] || ultimoPor[m.id] < subDays(now, 14).toISOString())

  return {
    mrr: receitaRecorrenteMensal(lancamentos, hoje),
    recebidoMes,
    entra30,
    sai30,
    atrasados,
    marketingMes,
    proximos,
    nomes,
    contratantes: contratantes.length,
    cadastros: cadastros.length,
    leads7: leads7Res.count ?? 0,
    diagnosticos: diagRes.count ?? 0,
    aguardando: aguardandoRes.count ?? 0,
    orcHoje: orcamentos.filter((o) => (o.created_at as string) >= inicioHoje).length,
    orcSemana: orcamentos.filter((o) => (o.created_at as string) >= semana).length,
    orcamentosPorDia,
    risco,
  }
}

export default async function DashboardPage() {
  await requireAdminAuth()
  const m = await carregar()
  const resultado30 = m.entra30 - m.sai30

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" subtitle="Visão geral do MarmoApp, com dados reais" />

      <main className="flex-1 space-y-6 p-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Receita</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard title="Receita recorrente / mês" value={brl(m.mrr)} accent="gold" subtitle="contratos ativos, semana = 52/12" />
            <MetricCard title="Recebido no mês" value={brl(m.recebidoMes)} accent="green" subtitle="entradas marcadas como recebidas" />
            <MetricCard title="A receber · 30 dias" value={brl(m.entra30)} subtitle="inclui atrasados" />
            <MetricCard title="Marmorarias contratantes" value={m.contratantes} subtitle={`${m.cadastros} cadastro(s) sem contrato`} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Caixa</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard title="A pagar · 30 dias" value={brl(m.sai30)} accent="red" subtitle="saídas previstas" />
            <MetricCard
              title="Resultado previsto · 30 dias"
              value={brl(resultado30)}
              accent={resultado30 >= 0 ? 'green' : 'red'}
              subtitle="a receber − a pagar"
            />
            <MetricCard title="Marketing no mês" value={brl(m.marketingMes)} subtitle="gasto já pago" />
            <MetricCard
              title="Recebimentos atrasados"
              value={m.atrasados.length}
              accent={m.atrasados.length ? 'red' : 'default'}
              subtitle={m.atrasados.length ? brl(m.atrasados.reduce((s, o) => s + o.valor, 0)) : 'nenhum'}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Comercial e produto</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard title="Leads · 7 dias" value={m.leads7} />
            <MetricCard title="Diagnósticos" value={m.diagnosticos} subtitle="calls registradas" />
            <MetricCard title="Aguardando assinatura" value={m.aguardando} subtitle="contratos enviados" />
            <MetricCard title="Orçamentos hoje" value={m.orcHoje} subtitle="nas marmorarias" />
            <MetricCard title="Orçamentos · 7 dias" value={m.orcSemana} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Orçamentos criados nas marmorarias — últimos 30 dias</h2>
            <OrcamentosChartLazy data={m.orcamentosPorDia} />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Próximos recebimentos</h2>
              <Link href="/pagamentos" className="text-xs font-medium text-gold-dk hover:underline">
                Ver todos
              </Link>
            </div>
            {m.proximos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum recebimento previsto. Cadastre a mensalidade na página do cliente.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {m.proximos.map((o) => (
                  <li key={o.chave} className="flex items-center justify-between py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">
                        {(o.marmoraria_id && m.nomes[o.marmoraria_id]) || o.descricao}
                      </span>
                      <span className="text-xs text-gray-500">{dataBR(o.data)}</span>
                    </span>
                    <span className="font-semibold text-gray-900">{brl(o.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Contratantes em risco</h2>
          <p className="mb-4 text-xs text-gray-500">Marmorarias que pagam e não criaram orçamento nos últimos 14 dias</p>
          {m.risco.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum contratante em risco no momento.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {m.risco.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-900">{c.nome}</span>
                  <Link href={`/clientes/${c.id}`} className="btn-outline btn-sm">
                    Abrir cliente
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

import Link from 'next/link'
import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import TabelaOcorrencias from '@/components/financeiro/TabelaOcorrencias'
import FormLancamento from '@/components/financeiro/FormLancamento'
import PainelMarketing from '@/components/financeiro/PainelMarketing'
import {
  carregarClassificacoes,
  carregarInvestimentosComRetorno,
  carregarLancamentos,
  idsForaDosNumeros,
} from '@/lib/financeiro-servidor'
import { data as lerData } from '@/lib/financeiro-validacao'
import {
  brl,
  expandir,
  hojeBR,
  nomeCategoria,
  receitaRecorrenteMensal,
  somarDias,
  somarMeses,
  type Ocorrencia,
} from '@/lib/financeiro'

export const metadata = { title: 'Financeiro' }

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

type SP = Promise<{ aba?: string; de?: string; ate?: string; tipo?: string }>

export default async function FinanceiroPage({ searchParams }: { searchParams: SP }) {
  await requireAdminAuth()
  const sp = await searchParams
  const aba = sp.aba === 'lancamentos' || sp.aba === 'marketing' ? sp.aba : 'visao'
  const hoje = hojeBR()

  const [lancamentos, classificacoes, marmRes] = await Promise.all([
    carregarLancamentos(),
    carregarClassificacoes(),
    supabaseAdmin.from('marmorarias').select('id, nome').order('nome'),
  ])
  const investimentos = await carregarInvestimentosComRetorno(lancamentos)
  const fora = idsForaDosNumeros(classificacoes)
  const clientes = (marmRes.data ?? []).filter((m) => !fora.has(m.id)).map((m) => ({ id: m.id, nome: m.nome as string }))
  const nomesClientes = Object.fromEntries((marmRes.data ?? []).map((m) => [m.id, m.nome as string]))
  const nomesInvestimentos = Object.fromEntries(investimentos.map((i) => [i.id, i.nome]))
  const opcoesInv = investimentos.map((i) => ({ id: i.id, nome: i.nome }))

  const abas = [
    { id: 'visao', nome: 'Visão geral e previsão' },
    { id: 'lancamentos', nome: 'Entradas e saídas' },
    { id: 'marketing', nome: 'Investimentos em marketing' },
  ]

  return (
    <div className="flex flex-col">
      <Header title="Financeiro" subtitle="Previsão de entradas e saídas do MarmoApp e retorno dos investimentos" />
      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-6 text-sm">
          {abas.map((a) => (
            <Link
              key={a.id}
              href={`/financeiro${a.id === 'visao' ? '' : `?aba=${a.id}`}`}
              className={`-mb-px border-b-2 py-3 font-medium ${aba === a.id ? 'border-gold text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              {a.nome}
            </Link>
          ))}
        </nav>
      </div>

      <main className="space-y-6 p-6">
        {aba === 'visao' && <Visao lancamentos={lancamentos} hoje={hoje} investido={investimentos.reduce((s, i) => s + i.investido, 0)} />}

        {aba === 'lancamentos' && (
          <Lancamentos
            ocorrencias={expandir(
              lancamentos,
              lerData(sp.de) ?? somarDias(hoje, -30),
              lerData(sp.ate) ?? somarDias(hoje, 60),
              hoje,
            ).filter((o) => (sp.tipo === 'entrada' || sp.tipo === 'saida' ? o.tipo === sp.tipo : true))}
            de={lerData(sp.de) ?? somarDias(hoje, -30)}
            ate={lerData(sp.ate) ?? somarDias(hoje, 60)}
            tipo={sp.tipo ?? ''}
            clientes={clientes}
            investimentos={opcoesInv}
            nomesClientes={nomesClientes}
            nomesInvestimentos={nomesInvestimentos}
          />
        )}

        {aba === 'marketing' && (
          <PainelMarketing
            investimentos={investimentos}
            gastos={expandir(lancamentos, '2025-01-01', somarDias(hoje, 400), hoje).filter((o) => o.investimento_id)}
          />
        )}
      </main>
    </div>
  )
}

function Visao({ lancamentos, hoje, investido }: { lancamentos: Parameters<typeof expandir>[0]; hoje: string; investido: number }) {
  const inicioMes = hoje.slice(0, 8) + '01'
  const fimProjecao = somarMeses(inicioMes, 6)
  const oc = expandir(lancamentos, somarMeses(inicioMes, -2), somarDias(fimProjecao, -1), hoje)
  const valida = (o: Ocorrencia) => o.status !== 'cancelado'

  // mês a mês: realizado nos meses passados, previsto (inclui atrasados) daqui para a frente
  const meses = Array.from({ length: 8 }, (_, i) => somarMeses(inicioMes, i - 2))
  let acumulado = 0
  const linhas = meses.map((m) => {
    const fim = somarMeses(m, 1)
    const doMes = oc.filter((o) => valida(o) && o.data >= m && o.data < fim)
    const ent = doMes.filter((o) => o.tipo === 'entrada').reduce((s, o) => s + o.valor, 0)
    const sai = doMes.filter((o) => o.tipo === 'saida').reduce((s, o) => s + o.valor, 0)
    const realizado = doMes.filter((o) => o.status === 'realizado')
    const entR = realizado.filter((o) => o.tipo === 'entrada').reduce((s, o) => s + o.valor, 0)
    const saiR = realizado.filter((o) => o.tipo === 'saida').reduce((s, o) => s + o.valor, 0)
    acumulado += ent - sai
    return { m, ent, sai, entR, saiR, res: ent - sai, acumulado, passado: fim <= inicioMes }
  })
  const maior = Math.max(1, ...linhas.map((l) => Math.max(l.ent, l.sai)))

  const em90 = somarDias(hoje, 90)
  const proximas = oc.filter((o) => (o.status === 'previsto' || o.status === 'atrasado') && o.data <= em90)
  const saidas90: Record<string, number> = {}
  for (const o of proximas.filter((o) => o.tipo === 'saida')) saidas90[o.categoria] = (saidas90[o.categoria] ?? 0) + o.valor
  const ent90 = proximas.filter((o) => o.tipo === 'entrada').reduce((s, o) => s + o.valor, 0)
  const sai90 = proximas.filter((o) => o.tipo === 'saida').reduce((s, o) => s + o.valor, 0)
  const mesAtual = linhas[2]

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Receita recorrente / mês" value={brl(receitaRecorrenteMensal(lancamentos, hoje))} accent="gold" subtitle="mensalidades ativas" />
        <MetricCard
          title="Realizado no mês"
          value={brl(mesAtual.entR - mesAtual.saiR)}
          accent={mesAtual.entR - mesAtual.saiR >= 0 ? 'green' : 'red'}
          subtitle={`${brl(mesAtual.entR)} entrou · ${brl(mesAtual.saiR)} saiu`}
        />
        <MetricCard
          title="Previsto · 90 dias"
          value={brl(ent90 - sai90)}
          accent={ent90 - sai90 >= 0 ? 'green' : 'red'}
          subtitle={`${brl(ent90)} a receber · ${brl(sai90)} a pagar`}
        />
        <MetricCard title="Investido em marketing" value={brl(investido)} subtitle="gastos pagos ligados a campanhas" />
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Fluxo mês a mês</h2>
            <p className="text-xs text-gray-500">2 meses anteriores e os próximos 6. Datas puladas não entram.</p>
          </div>
          <Link href="/financeiro?aba=lancamentos" className="btn-gold btn-sm">
            + Lançar entrada ou saída
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-5 py-3 font-medium">Mês</th>
              <th className="px-5 py-3 font-medium">Entradas</th>
              <th className="px-5 py-3 font-medium">Saídas</th>
              <th className="px-5 py-3 font-medium">Resultado</th>
              <th className="px-5 py-3 font-medium">Acumulado</th>
              <th className="w-[30%] px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.map((l) => {
              const [a, mm] = l.m.split('-')
              const atual = l.m === inicioMes
              return (
                <tr key={l.m} className={atual ? 'bg-[rgba(201,168,76,0.07)]' : ''}>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">
                    {MESES[Number(mm) - 1]}/{a.slice(2)}
                    {atual && <span className="ml-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold text-[#0D0D0D]">ATUAL</span>}
                    {l.passado && <span className="ml-2 text-[11px] text-gray-400">fechado</span>}
                  </td>
                  <td className="px-5 py-3 text-emerald-700">{brl(l.ent)}</td>
                  <td className="px-5 py-3 text-red-700">{brl(l.sai)}</td>
                  <td className={`px-5 py-3 font-semibold ${l.res >= 0 ? 'text-gray-900' : 'text-red-700'}`}>{brl(l.res)}</td>
                  <td className={`px-5 py-3 ${l.acumulado >= 0 ? 'text-gray-700' : 'text-red-700'}`}>{brl(l.acumulado)}</td>
                  <td className="px-5 py-3">
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(l.ent / maior) * 100}%` }} />
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(l.sai / maior) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Para onde vai o dinheiro · próximos 90 dias</h2>
        <p className="mb-4 text-xs text-gray-500">Saídas previstas por categoria</p>
        {Object.keys(saidas90).length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma saída prevista. Lance as despesas fixas (servidor, ferramentas, anúncios) como recorrentes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {Object.entries(saidas90)
              .sort((a, b) => b[1] - a[1])
              .map(([c, v]) => (
                <li key={c} className="flex items-center gap-3">
                  <span className="w-64 shrink-0 text-gray-700">{nomeCategoria('saida', c)}</span>
                  <span className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(2, (v / sai90) * 60)}%` }} />
                  <span className="ml-auto font-semibold text-gray-900">{brl(v)}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  )
}

function Lancamentos(p: {
  ocorrencias: Ocorrencia[]
  de: string
  ate: string
  tipo: string
  clientes: { id: string; nome: string }[]
  investimentos: { id: string; nome: string }[]
  nomesClientes: Record<string, string>
  nomesInvestimentos: Record<string, string>
}) {
  const ent = p.ocorrencias.filter((o) => o.tipo === 'entrada' && o.status !== 'cancelado').reduce((s, o) => s + o.valor, 0)
  const sai = p.ocorrencias.filter((o) => o.tipo === 'saida' && o.status !== 'cancelado').reduce((s, o) => s + o.valor, 0)
  return (
    <>
      <FormLancamento clientes={p.clientes} investimentos={p.investimentos} />

      <div className="card">
        <form className="flex flex-wrap items-end gap-3 border-b border-gray-200 px-5 py-4" method="get">
          <input type="hidden" name="aba" value="lancamentos" />
          <label>
            <span className="rotulo">De</span>
            <input className="campo" type="date" name="de" defaultValue={p.de} />
          </label>
          <label>
            <span className="rotulo">Até</span>
            <input className="campo" type="date" name="ate" defaultValue={p.ate} />
          </label>
          <label>
            <span className="rotulo">Tipo</span>
            <select className="campo" name="tipo" defaultValue={p.tipo}>
              <option value="">Entradas e saídas</option>
              <option value="entrada">Só entradas</option>
              <option value="saida">Só saídas</option>
            </select>
          </label>
          <button className="btn-outline">Filtrar</button>
          <div className="ml-auto text-right text-sm">
            <span className="text-emerald-700">+ {brl(ent)}</span>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-red-700">− {brl(sai)}</span>
            <span className="mx-2 text-gray-300">|</span>
            <b className={ent - sai >= 0 ? 'text-gray-900' : 'text-red-700'}>{brl(ent - sai)}</b>
          </div>
        </form>
        <TabelaOcorrencias ocorrencias={p.ocorrencias} nomesClientes={p.nomesClientes} nomesInvestimentos={p.nomesInvestimentos} />
      </div>
    </>
  )
}

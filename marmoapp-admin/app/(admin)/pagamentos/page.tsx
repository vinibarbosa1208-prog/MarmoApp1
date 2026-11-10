import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import TabelaOcorrencias from '@/components/financeiro/TabelaOcorrencias'
import FormLancamento from '@/components/financeiro/FormLancamento'
import { carregarClassificacoes, carregarLancamentos, idsForaDosNumeros } from '@/lib/financeiro-servidor'
import { brl, expandir, hojeBR, receitaRecorrenteMensal, somarDias } from '@/lib/financeiro'

export const metadata = { title: 'Pagamentos de clientes' }

// Controle dos pagamentos das marmorarias: o que venceu, o que entrou e o que vem.
// Nenhuma cobrança é disparada daqui; só se registra o que foi recebido.
export default async function PagamentosPage() {
  await requireAdminAuth()
  const hoje = hojeBR()
  const [lancamentos, classificacoes, marmRes] = await Promise.all([
    carregarLancamentos(),
    carregarClassificacoes(),
    supabaseAdmin.from('marmorarias').select('id, nome').order('nome'),
  ])
  const fora = idsForaDosNumeros(classificacoes)
  const nomes = Object.fromEntries((marmRes.data ?? []).map((m) => [m.id, m.nome as string]))
  const clientes = (marmRes.data ?? [])
    .filter((m) => !fora.has(m.id))
    .sort((a, b) => Number(classificacoes[b.id] === 'contratante') - Number(classificacoes[a.id] === 'contratante'))
    .map((m) => ({ id: m.id, nome: m.nome as string }))

  const doCliente = lancamentos.filter((l) => l.tipo === 'entrada' && l.marmoraria_id)
  const oc = expandir(doCliente, somarDias(hoje, -60), somarDias(hoje, 45), hoje)
  const atrasados = oc.filter((o) => o.status === 'atrasado')
  const proximos = oc.filter((o) => o.status === 'previsto')
  const recebidos = oc.filter((o) => o.status === 'realizado' || o.status === 'cancelado').reverse()
  const recebido30 = oc
    .filter((o) => o.status === 'realizado' && (o.data_realizada ?? o.data) >= somarDias(hoje, -30))
    .reduce((s, o) => s + o.valor, 0)

  return (
    <div className="flex flex-col">
      <Header title="Pagamentos de clientes" subtitle="Mensalidades e implantações das marmorarias contratantes" />
      <main className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard title="Receita recorrente / mês" value={brl(receitaRecorrenteMensal(lancamentos, hoje))} accent="gold" />
          <MetricCard title="Recebido · 30 dias" value={brl(recebido30)} accent="green" />
          <MetricCard
            title="Em atraso"
            value={brl(atrasados.reduce((s, o) => s + o.valor, 0))}
            accent={atrasados.length ? 'red' : 'default'}
            subtitle={`${atrasados.length} pagamento(s)`}
          />
          <MetricCard title="A receber · 45 dias" value={brl(proximos.reduce((s, o) => s + o.valor, 0))} subtitle={`${proximos.length} pagamento(s)`} />
        </div>

        {atrasados.length > 0 && (
          <section className="card border-red-200">
            <h2 className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-red-700">Em atraso</h2>
            <TabelaOcorrencias ocorrencias={atrasados} nomesClientes={nomes} />
          </section>
        )}

        <section className="card">
          <h2 className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900">Próximos 45 dias</h2>
          <TabelaOcorrencias ocorrencias={proximos} nomesClientes={nomes} vazio="Nenhum pagamento previsto. Cadastre a mensalidade abaixo ou na página do cliente." />
        </section>

        <FormLancamento
          titulo="Nova mensalidade ou cobrança de cliente"
          clientes={clientes}
          tipoInicial="entrada"
          categoriaInicial="mensalidade"
          recorrenciaInicial="mensal"
        />

        <section className="card">
          <h2 className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900">Recebidos nos últimos 60 dias</h2>
          <TabelaOcorrencias ocorrencias={recebidos} nomesClientes={nomes} vazio="Nenhum recebimento registrado ainda." />
        </section>
      </main>
    </div>
  )
}

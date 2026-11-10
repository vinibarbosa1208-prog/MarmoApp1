import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import MetricCard from '@/components/MetricCard'
import ClassificacaoCliente from '@/components/clientes/ClassificacaoCliente'
import TabelaOcorrencias from '@/components/financeiro/TabelaOcorrencias'
import FormLancamento from '@/components/financeiro/FormLancamento'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { Usuario, Orcamento } from '@/lib/types'
import { carregarClassificacoes, carregarLancamentos } from '@/lib/financeiro-servidor'
import { brl, dataBR, expandir, hojeBR, receitaRecorrenteMensal, somarDias, type TipoCliente } from '@/lib/financeiro'

const ROTULO_CONTRATO: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Aguardando assinatura',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
}

// Central do cliente: situação, ações (contrato, apresentação, pagamentos),
// contratos e diagnósticos ligados a ele, usuários e orçamentos.
export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAuth()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [marmorariaRes, usuariosRes, orcamentosRes, classificacoes, lancamentos] = await Promise.all([
    supabaseAdmin.from('marmorarias').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('usuarios').select('*').eq('marmoraria_id', id),
    supabaseAdmin.from('orcamentos').select('*').eq('marmoraria_id', id).order('created_at', { ascending: false }).limit(10),
    carregarClassificacoes(),
    carregarLancamentos({ marmoraria_id: id }),
  ])
  if (!marmorariaRes.data) notFound()

  const m = marmorariaRes.data
  const tipo: TipoCliente = classificacoes[id] ?? 'cadastro'
  const usuarios = (usuariosRes.data ?? []) as Usuario[]
  const orcamentos = (orcamentosRes.data ?? []) as Orcamento[]
  const nomeBusca = String(m.nome).trim().replace(/[%_,()]/g, ' ')
  const cnpj = String(m.cnpj ?? '').replace(/\D/g, '')

  const [contratosRes, leadsRes] = await Promise.all([
    supabaseAdmin
      .from('contratos')
      .select('id, numero, status, plano, mensalidade, assinado_em, created_at, contratante')
      .or(
        [`contratante->>razao_social.ilike.%${nomeBusca}%`, ...(cnpj.length === 14 ? [`contratante->>documento.eq.${cnpj}`] : [])].join(','),
      )
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin.from('leads').select('id').ilike('nome_marmoraria', `%${nomeBusca}%`).limit(20),
  ])
  const leadIds = (leadsRes.data ?? []).map((l) => l.id as string)
  const diagnosticos = leadIds.length
    ? ((await supabaseAdmin.from('diagnosticos').select('id, data_call, valor_na_mesa, plano_recomendado, resultado').in('lead_id', leadIds).order('created_at', { ascending: false })).data ?? [])
    : []
  const contratos = contratosRes.data ?? []

  const hoje = hojeBR()
  const oc = expandir(lancamentos, somarDias(hoje, -90), somarDias(hoje, 60), hoje)
  const atrasado = oc.filter((o) => o.status === 'atrasado').reduce((s, o) => s + o.valor, 0)
  const recebidoTotal = expandir(lancamentos, '2025-01-01', hoje, hoje)
    .filter((o) => o.tipo === 'entrada' && o.status === 'realizado')
    .reduce((s, o) => s + o.valor, 0)
  const proximo = oc.find((o) => o.tipo === 'entrada' && o.status === 'previsto' && o.data >= hoje)

  const qs = new URLSearchParams({
    empresa: m.nome ?? '',
    ...(m.cidade ? { cidade: m.cidade } : {}),
    ...(m.email ? { email: m.email } : {}),
    ...(m.telefone ? { whatsapp: m.telefone } : {}),
  })
  const ultimoDiag = diagnosticos[0]?.id as string | undefined
  const linkApresentacao = ultimoDiag ? `/apresentacao?diagnostico=${ultimoDiag}` : `/apresentacao?${qs}`

  return (
    <div className="flex flex-col">
      <Header
        title={m.nome}
        subtitle={[m.cidade && `${m.cidade}${m.estado ? `-${m.estado}` : ''}`, m.cnpj && `CNPJ ${m.cnpj}`].filter(Boolean).join(' · ') || `ID ${m.id}`}
        action={
          <Link href="/clientes" className="btn-outline">
            ← Clientes
          </Link>
        }
      />

      <main className="space-y-6 p-6">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="rotulo">Situação no MarmoApp</p>
            <ClassificacaoCliente id={id} tipo={tipo} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/contratos/novo?marmoraria=${id}`} className="btn-gold">
              Gerar contrato
            </Link>
            <a href={linkApresentacao} target="_blank" rel="noopener" className="btn-outline">
              {ultimoDiag ? 'Abrir apresentação do diagnóstico' : 'Criar apresentação'}
            </a>
            <a href="#pagamentos" className="btn-outline">
              Pagamentos
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard title="Receita / mês" value={brl(receitaRecorrenteMensal(lancamentos, hoje))} accent="gold" />
          <MetricCard title="Já recebido" value={brl(recebidoTotal)} accent="green" />
          <MetricCard title="Em atraso" value={brl(atrasado)} accent={atrasado > 0 ? 'red' : 'default'} />
          <MetricCard title="Próximo pagamento" value={proximo ? brl(proximo.valor) : '—'} subtitle={proximo ? dataBR(proximo.data) : 'nada previsto'} />
        </div>

        <section id="pagamentos" className="card scroll-mt-20">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Pagamentos</h2>
            <p className="text-xs text-gray-500">Últimos 90 dias e próximos 60. Registro manual: nada é cobrado automaticamente daqui.</p>
          </div>
          <TabelaOcorrencias ocorrencias={oc} mostrarCliente={false} vazio="Nenhum pagamento cadastrado para esta marmoraria." />
        </section>

        <FormLancamento
          titulo="Cadastrar mensalidade ou cobrança"
          marmoraria={{ id, nome: m.nome }}
          tipoInicial="entrada"
          categoriaInicial="mensalidade"
          recorrenciaInicial="mensal"
          descricaoInicial={`Mensalidade ${m.nome}`}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Contratos</h2>
              <Link href={`/contratos/novo?marmoraria=${id}`} className="text-xs font-medium text-gold-dk hover:underline">
                + Novo contrato
              </Link>
            </div>
            {contratos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum contrato com o nome ou CNPJ desta marmoraria.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {contratos.map((c) => (
                  <li key={c.id as string} className="flex items-center justify-between py-2">
                    <Link href={`/contratos/${c.id}`} className="font-medium text-gray-900 hover:text-gold-dk">
                      {c.numero as string} · {String(c.plano)}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {ROTULO_CONTRATO[c.status as string] ?? c.status} · {brl(Number(c.mensalidade))}/mês
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Diagnósticos</h2>
              <a href={`/apresentacao?${qs}`} target="_blank" rel="noopener" className="text-xs font-medium text-gold-dk hover:underline">
                + Nova apresentação
              </a>
            </div>
            {diagnosticos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum diagnóstico salvo com o nome desta marmoraria.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {diagnosticos.map((d) => (
                  <li key={d.id as string} className="flex items-center justify-between py-2">
                    <a href={`/apresentacao?diagnostico=${d.id}`} target="_blank" rel="noopener" className="font-medium text-gray-900 hover:text-gold-dk">
                      Call de {dataBR(d.data_call as string | null)}
                    </a>
                    <span className="text-xs text-gray-500">
                      {d.valor_na_mesa != null ? `${brl(Number(d.valor_na_mesa))} na mesa` : 'sem valor'}
                      {d.plano_recomendado ? ` · ${d.plano_recomendado}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">Plano no sistema</p>
            <StatusBadge value={m.plano} type="plano" />
          </div>
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">Configuração inicial</p>
            <p className={`font-medium ${m.setup_concluido ? 'text-emerald-700' : 'text-gray-600'}`}>{m.setup_concluido ? 'Concluída' : 'Pendente'}</p>
          </div>
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">Teste grátis até</p>
            <p className="font-medium text-gray-900">{m.trial_expira ? format(parseISO(m.trial_expira), 'dd/MM/yyyy') : '—'}</p>
          </div>
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">Cadastro</p>
            <p className="font-medium text-gray-900">{m.created_at ? format(parseISO(m.created_at), 'dd/MM/yyyy') : '—'}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Usuários ({usuarios.length})</h2>
            {usuarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {usuarios.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-900">{u.nome ?? '—'}</span>
                    <span className="text-xs text-gray-500">
                      {u.email ?? '—'} · {u.perfil ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Últimos orçamentos</h2>
            {orcamentos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum orçamento criado.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {orcamentos.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-900">{o.cliente_nome ?? '—'}</span>
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      {o.valor_total != null ? brl(o.valor_total) : '—'} · {format(parseISO(o.created_at), 'dd/MM/yy')}
                      <StatusBadge value={o.status} type="status" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

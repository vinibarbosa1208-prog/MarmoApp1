import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { Usuario, Orcamento } from '@/lib/types'

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminAuth()
  const { id } = await params

  const [marmorariaRes, usuariosRes, orcamentosRes] = await Promise.all([
    supabaseAdmin.from('marmorarias').select('*').eq('id', id).single(),
    supabaseAdmin.from('usuarios').select('*').eq('marmoraria_id', id),
    supabaseAdmin
      .from('orcamentos')
      .select('*')
      .eq('marmoraria_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!marmorariaRes.data) notFound()

  const m = marmorariaRes.data
  const usuarios = (usuariosRes.data ?? []) as Usuario[]
  const orcamentos = (orcamentosRes.data ?? []) as Orcamento[]

  return (
    <div className="flex flex-col">
      <Header
        title={m.nome}
        subtitle={`ID: ${m.id}`}
        action={
          <Link
            href="/clientes"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            ← Voltar
          </Link>
        }
      />

      <main className="p-6 space-y-6">
        {/* Info */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <p className="text-xs text-slate-500 mb-1">Plano</p>
            <StatusBadge value={m.plano} type="plano" />
          </div>
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <p className="text-xs text-slate-500 mb-1">Setup</p>
            <p className={`font-medium ${m.setup_concluido ? 'text-emerald-400' : 'text-slate-400'}`}>
              {m.setup_concluido ? 'Concluído' : 'Pendente'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <p className="text-xs text-slate-500 mb-1">Trial expira</p>
            <p className="font-medium text-white">
              {m.trial_expira ? format(parseISO(m.trial_expira), 'dd/MM/yyyy') : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <p className="text-xs text-slate-500 mb-1">Cadastro</p>
            <p className="font-medium text-white">
              {m.created_at ? format(parseISO(m.created_at), 'dd/MM/yyyy') : '—'}
            </p>
          </div>
        </div>

        {/* Usuários */}
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Usuários ({usuarios.length})
          </h2>
          {usuarios.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Nome', 'Email', 'Perfil'].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs text-slate-500 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 text-white">{u.nome ?? '—'}</td>
                    <td className="py-2.5 text-slate-400">{u.email ?? '—'}</td>
                    <td className="py-2.5">
                      <span className="text-xs text-slate-300 capitalize">{u.perfil ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Orçamentos recentes */}
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Orçamentos recentes ({orcamentos.length})
          </h2>
          {orcamentos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum orçamento criado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Cliente', 'Status', 'Valor', 'Data'].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs text-slate-500 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {orcamentos.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 text-white">{o.cliente_nome ?? '—'}</td>
                    <td className="py-2.5">
                      <StatusBadge value={o.status} type="status" />
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {o.valor_total != null
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(o.valor_total)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {format(parseISO(o.created_at), 'dd/MM/yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

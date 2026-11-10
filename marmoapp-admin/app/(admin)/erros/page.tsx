import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import { format, parseISO } from 'date-fns'
import type { ErrorLog } from '@/lib/types'

export default async function ErrosPage() {
  await requireAdminAuth()

  const { data } = await supabaseAdmin
    .from('error_logs')
    .select('*, marmorarias(nome)')
    .order('created_at', { ascending: false })
    .limit(50)

  const logs = (data ?? []) as ErrorLog[]

  return (
    <div className="flex flex-col">
      <Header title="Erros" subtitle="Últimos 50 erros capturados" />

      <main className="p-6">
        <div className="rounded-xl bg-white border border-gray-200 overflow-x-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum erro registrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Data', 'Rota', 'Marmoraria', 'Mensagem'].map((h) => (
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
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-100/20">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {format(parseISO(log.created_at), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {log.route ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {log.marmorarias?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <details className="cursor-pointer">
                        <summary className="text-red-700 text-xs line-clamp-1 list-none cursor-pointer">
                          {log.error_message ?? '(sem mensagem)'}
                        </summary>
                        {log.error_stack && (
                          <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-all max-w-xl">
                            {log.error_stack}
                          </pre>
                        )}
                      </details>
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

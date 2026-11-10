import { requireAdminAuth } from '@/lib/auth-admin'
import Header from '@/components/Header'
import { PLANO_PRECOS } from '@/lib/types'

export default async function ConfiguracoesPage() {
  const user = await requireAdminAuth()

  return (
    <div className="flex flex-col">
      <Header title="Configurações" />

      <main className="p-6 space-y-6 max-w-2xl">
        <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Sessão atual</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ID</span>
              <span className="text-gray-600 font-mono text-xs">{user.id}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Tabela de preços</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(PLANO_PRECOS).map(([plano, preco]) => (
              <div key={plano} className="flex justify-between">
                <span className="text-gray-500 capitalize">{plano}</span>
                <span className="text-gray-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    preco
                  )}
                  /mês
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Variáveis de ambiente</h2>
          <p className="text-xs text-gray-500">
            Configure as variáveis abaixo no painel do Vercel ou no arquivo{' '}
            <code className="text-gold-dk">.env.local</code>.
          </p>
          <div className="space-y-1 text-xs font-mono">
            {[
              'NEXT_PUBLIC_SUPABASE_URL',
              'NEXT_PUBLIC_SUPABASE_ANON_KEY',
              'SUPABASE_SERVICE_KEY',
              'NEXT_PUBLIC_APP_URL',
              'CRON_SECRET',
              'RESEND_API_KEY',
            ].map((v) => (
              <div key={v} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${process.env[v] ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
                <span className="text-gray-600">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

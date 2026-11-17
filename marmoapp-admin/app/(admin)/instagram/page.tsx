import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import { configInstagram, contaInstagram, janelaFila, type PostIG } from '@/lib/instagram'
import FilaInstagram from '@/components/instagram/FilaInstagram'
import NumerosInstagram from '@/components/instagram/NumerosInstagram'
import { carregarMetricasIG } from '@/lib/instagram-metricas'

export const metadata = { title: 'Instagram' }

export default async function InstagramPage() {
  await requireAdminAuth()
  const { desde, agora } = janelaFila()
  const [{ data }, metricas] = await Promise.all([
    supabaseAdmin.from('admin_ig_posts').select('*').gte('publicar_em', desde).order('publicar_em'),
    carregarMetricasIG(14),
  ])

  let conta: string | null = null
  let problema: string | null = null
  if (!configInstagram().pronto) problema = 'Falta o token de publicação (IG_PUBLISH_TOKEN) na Vercel. Os posts ficam na fila, mas não saem.'
  else {
    try {
      conta = (await contaInstagram()).username
    } catch (e) {
      problema = (e as Error).message
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Instagram" subtitle="Posts agendados do @marmoapp.oficial: aprove e eles saem sozinhos na hora marcada" />
      <main className="space-y-6 p-6">
        <div className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${problema ? 'border-red-200' : ''}`}>
          <p className="text-sm">
            {problema ? (
              <span className="text-red-700">⚠️ {problema}</span>
            ) : (
              <span className="text-emerald-700">
                ✅ Ligado à conta <b>@{conta}</b>. Posts aprovados saem em até 5 minutos depois do horário marcado.
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">Reels e Stories simples. Figurinhas (enquete, quiz, mencionar) só pelo app.</p>
        </div>
        <NumerosInstagram dados={metricas} />
        <FilaInstagram posts={(data ?? []) as PostIG[]} agora={agora} />
      </main>
    </div>
  )
}

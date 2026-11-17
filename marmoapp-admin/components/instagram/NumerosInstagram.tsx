import MetricCard from '@/components/MetricCard'
import BotaoAtualizarMetricas from '@/components/instagram/BotaoAtualizarMetricas'
import type { carregarMetricasIG } from '@/lib/instagram-metricas'

type Dados = Awaited<ReturnType<typeof carregarMetricasIG>>

const n = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR'))
const sinal = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}`)
const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export default function NumerosInstagram({ dados }: { dados: Dados }) {
  const { atual, novos7, visitas7, alcance7, porDia, ultimaBusca } = dados
  const semInsights = !!ultimaBusca?.mensagem?.includes('avisos:')
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Números do perfil</h2>
          <p className="text-xs text-gray-400">
            Atualiza sozinho de hora em hora.
            {ultimaBusca && ` Última busca: ${new Date(ultimaBusca.iniciado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}${ultimaBusca.ok ? '' : ' (falhou)'}.`}
          </p>
        </div>
        <BotaoAtualizarMetricas />
      </div>

      {ultimaBusca && !ultimaBusca.ok && <p className="card border-red-200 p-3 text-sm text-red-700">⚠️ {ultimaBusca.mensagem}</p>}
      {semInsights && (
        <p className="card border-yellow-200 p-3 text-xs text-yellow-800">
          Parte dos números do Insights não veio: {ultimaBusca?.mensagem?.split('avisos:')[1]}. Os novos seguidores são calculados pela diferença de um dia para o outro.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Seguidores" value={n(atual)} accent="gold" subtitle="agora" />
        <MetricCard title="Novos seguidores" value={sinal(novos7)} accent="green" subtitle="últimos 7 dias" />
        <MetricCard title="Visitas ao perfil" value={n(visitas7)} accent="blue" subtitle="últimos 7 dias" />
        <MetricCard title="Alcance" value={n(alcance7)} accent="purple" subtitle="soma dos últimos 7 dias" />
      </div>

      {porDia.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2">Dia</th>
                <th className="px-4 py-2 text-right">Seguidores</th>
                <th className="px-4 py-2 text-right">Novos</th>
                <th className="px-4 py-2 text-right">Visitas ao perfil</th>
                <th className="px-4 py-2 text-right">Alcance</th>
              </tr>
            </thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.data} className="border-t border-gray-100">
                  <td className="px-4 py-2">{diaCurto(d.data)}</td>
                  <td className="px-4 py-2 text-right">{n(d.seguidores)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{sinal(d.novos)}</td>
                  <td className="px-4 py-2 text-right">{n(d.visitas_perfil)}</td>
                  <td className="px-4 py-2 text-right">{n(d.alcance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

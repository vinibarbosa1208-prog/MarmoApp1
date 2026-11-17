// Números do perfil @marmoapp.oficial, um registro por dia em admin_ig_metricas.
// - seguidores / seguindo / posts: foto do momento (a última busca do dia fica valendo).
// - novos_seguidores, visitas_perfil, alcance: vêm do Insights do Instagram e precisam
//   da permissão instagram_manage_insights no token. Sem ela, os novos seguidores do dia
//   são calculados pela diferença entre a foto de hoje e a de ontem.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { chamar, configInstagram, contaInstagram } from '@/lib/instagram'
import { hojeBR, somarDias } from '@/lib/financeiro'

type Valor = { value?: number; end_time?: string }
type Linha = { data: string } & Record<string, number | string>

const DIA = 86400

/** Meia-noite (horário de Brasília) do dia, em segundos Unix. */
function inicioDoDia(data: string) {
  return Math.floor(new Date(`${data}T00:00:00-03:00`).getTime() / 1000)
}

/** O Insights marca cada dia pelo fim dele (end_time); o dia de verdade é o anterior. */
function diaDoEndTime(end: string) {
  return somarDias(end.slice(0, 10), -1)
}

async function gravar(coluna: string, linhas: Linha[]) {
  if (!linhas.length) return
  // Uma coluna por vez: assim uma busca nunca apaga o que outra gravou.
  const agora = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('admin_ig_metricas')
    .upsert(linhas.map((l) => ({ data: l.data, [coluna]: l[coluna], atualizado_em: agora })), { onConflict: 'data' })
  if (error) throw new Error(error.message)
}

export async function sincronizarMetricasIG(origem: 'manual' | 'cron') {
  const { token, pronto } = configInstagram()
  if (!pronto || !token) throw new Error('Instagram não configurado: falta IG_PUBLISH_TOKEN na Vercel.')
  const avisos: string[] = []
  try {
    const conta = await contaInstagram()
    const hoje = hojeBR()

    // 1) Foto do perfil agora
    const p = await chamar('GET', conta.id, { fields: 'followers_count,follows_count,media_count' }, token)
    const seguidores = Number(p.followers_count ?? 0)
    await gravar('seguidores', [{ data: hoje, seguidores }])
    await gravar('seguindo', [{ data: hoje, seguindo: Number(p.follows_count ?? 0) }])
    await gravar('posts', [{ data: hoje, posts: Number(p.media_count ?? 0) }])

    // Primeira vez (tabela quase vazia) busca 30 dias para trás; depois, só os últimos dias.
    const { count } = await supabaseAdmin.from('admin_ig_metricas').select('data', { count: 'exact', head: true })
    const dias = (count ?? 0) < 5 ? 29 : 3
    const desde = somarDias(hoje, -dias)

    // 2) Novos seguidores por dia (série de até 30 dias, sem o dia de hoje)
    try {
      const r = await chamar('GET', `${conta.id}/insights`, {
        metric: 'follower_count',
        period: 'day',
        since: String(inicioDoDia(desde)),
        until: String(inicioDoDia(hoje)),
      }, token)
      const valores = ((r.data as { values?: Valor[] }[])?.[0]?.values ?? []).filter((v) => v.end_time)
      await gravar('novos_seguidores', valores.map((v) => ({ data: diaDoEndTime(v.end_time!), novos_seguidores: Number(v.value ?? 0) })))
    } catch (e) {
      avisos.push(`novos seguidores: ${(e as Error).message}`)
    }

    // 3) Alcance por dia
    try {
      const r = await chamar('GET', `${conta.id}/insights`, {
        metric: 'reach',
        period: 'day',
        since: String(inicioDoDia(desde)),
        until: String(inicioDoDia(hoje) + DIA),
      }, token)
      const valores = ((r.data as { values?: Valor[] }[])?.[0]?.values ?? []).filter((v) => v.end_time)
      await gravar('alcance', valores.map((v) => ({ data: diaDoEndTime(v.end_time!), alcance: Number(v.value ?? 0) })))
    } catch (e) {
      avisos.push(`alcance: ${(e as Error).message}`)
    }

    // 4) Visitas ao perfil: o Instagram só devolve o total do período, então é um dia por chamada.
    try {
      const linhas: Linha[] = []
      for (let d = desde; d <= hoje; d = somarDias(d, 1)) {
        const r = await chamar('GET', `${conta.id}/insights`, {
          metric: 'profile_views',
          period: 'day',
          metric_type: 'total_value',
          since: String(inicioDoDia(d)),
          until: String(Math.min(inicioDoDia(d) + DIA, Math.floor(Date.now() / 1000))),
        }, token)
        const v = (r.data as { total_value?: { value?: number } }[])?.[0]?.total_value?.value
        linhas.push({ data: d, visitas_perfil: Number(v ?? 0) })
      }
      await gravar('visitas_perfil', linhas)
    } catch (e) {
      avisos.push(`visitas ao perfil: ${(e as Error).message}`)
    }

    const msg = `@${conta.username}: ${seguidores} seguidores` + (avisos.length ? ` · avisos: ${avisos.join(' | ')}` : '')
    await supabaseAdmin.from('admin_ig_metricas_sync').insert({ origem, ok: true, mensagem: msg.slice(0, 1000) })
    return { seguidores, avisos }
  } catch (e) {
    await supabaseAdmin.from('admin_ig_metricas_sync').insert({ origem, ok: false, mensagem: (e as Error).message.slice(0, 1000) })
    throw e
  }
}

export type DiaIG = {
  data: string
  seguidores: number | null
  novos: number | null
  visitas_perfil: number | null
  alcance: number | null
}

/**
 * Últimos `dias` dias para a tela. Quando o Insights não trouxe os novos seguidores,
 * usa a diferença entre a contagem do dia e a do dia anterior.
 */
export async function carregarMetricasIG(dias = 14) {
  const hoje = hojeBR()
  const desde = somarDias(hoje, -dias)
  const [{ data }, { data: ultima }] = await Promise.all([
    supabaseAdmin.from('admin_ig_metricas').select('*').gte('data', desde).order('data'),
    supabaseAdmin.from('admin_ig_metricas_sync').select('*').order('iniciado_em', { ascending: false }).limit(1).maybeSingle(),
  ])
  const linhas = (data ?? []) as {
    data: string; seguidores: number | null; novos_seguidores: number | null; visitas_perfil: number | null; alcance: number | null
  }[]
  const porDia: DiaIG[] = linhas.map((l, i) => {
    const anterior = linhas[i - 1]
    const diferenca =
      l.seguidores != null && anterior?.seguidores != null && anterior.data === somarDias(l.data, -1)
        ? l.seguidores - anterior.seguidores
        : null
    return {
      data: l.data,
      seguidores: l.seguidores,
      novos: l.novos_seguidores ?? diferenca,
      visitas_perfil: l.visitas_perfil,
      alcance: l.alcance,
    }
  })
  const atual = [...linhas].reverse().find((l) => l.seguidores != null)?.seguidores ?? null
  const ultimos7 = porDia.filter((d) => d.data > somarDias(hoje, -7))
  const soma = (k: 'novos' | 'visitas_perfil' | 'alcance') => {
    const v = ultimos7.map((d) => d[k]).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) : null
  }
  return {
    atual,
    novos7: soma('novos'),
    visitas7: soma('visitas_perfil'),
    alcance7: soma('alcance'),
    porDia: porDia.reverse(),
    ultimaBusca: ultima as { iniciado_em: string; ok: boolean; mensagem: string | null } | null,
  }
}

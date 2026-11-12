// Integração com a Marketing API do Meta (Facebook + Instagram Ads), só leitura.
// Precisa de META_ADS_TOKEN (token de usuário do sistema com ads_read) e
// META_AD_ACCOUNT_ID (o número da conta de anúncios, com ou sem "act_").
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hojeBR, somarDias } from '@/lib/financeiro'

const VERSAO = process.env.META_API_VERSION || 'v26.0'

// Limpa o que costuma vir junto ao colar o token: espaços, quebras de linha,
// aspas, "Bearer " ou "access_token=" na frente.
function limparToken(bruto: string | undefined) {
  if (!bruto) return undefined
  let t = bruto.replace(/\s+/g, '')
  t = t.replace(/^["'`]+|["'`]+$/g, '')
  t = t.replace(/^Bearer/i, '').replace(/^access_token=/i, '')
  return t || undefined
}

export function configMeta() {
  const token = limparToken(process.env.META_ADS_TOKEN)
  const conta = process.env.META_AD_ACCOUNT_ID?.trim().replace(/^act_/, '')
  return { token, conta, pronto: !!token && !!conta && /^\d+$/.test(conta) }
}

/** Diz, sem expor o token, por que ele não parece um token válido da Meta. */
export function diagnosticoToken(token: string) {
  if (!token.startsWith('EAA'))
    return `o valor salvo não parece um token da Meta (um token começa com "EAA" e tem mais de 100 caracteres; o salvo tem ${token.length})`
  if (token.length < 100) return `o token parece cortado (tem ${token.length} caracteres; um token completo tem mais de 100)`
  return null
}

type Acao = { action_type: string; value: string }

async function get(caminho: string, params: Record<string, string>, token: string) {
  let url: string | null = `https://graph.facebook.com/${VERSAO}/${caminho}?${new URLSearchParams(params)}`
  const dados: Record<string, unknown>[] = []
  let paginas = 0
  while (url && paginas < 20) {
    // O token vai no cabeçalho, nunca na URL (não aparece em logs).
    const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) {
      const e = j.error ?? {}
      throw new Error(`Meta ${r.status}: ${e.message ?? 'erro desconhecido'}${e.code ? ` (código ${e.code})` : ''}`)
    }
    dados.push(...(j.data ?? []))
    url = j.paging?.next ?? null
    paginas++
  }
  return dados
}

function somaAcoes(acoes: Acao[] | undefined, tipos: string[]) {
  if (!acoes) return 0
  // Cada tipo de lead pode vir repetido em agrupamentos diferentes: usa o maior deles.
  let maior = 0
  for (const t of tipos) {
    const a = acoes.find((x) => x.action_type === t)
    if (a) maior = Math.max(maior, Number(a.value) || 0)
  }
  return maior
}

const TIPOS_LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_web_lead']
const TIPOS_CONVERSA = ['onsite_conversion.messaging_conversation_started_7d']

/**
 * Busca campanhas e números por dia dos últimos `dias` e grava no banco.
 * Depois atualiza no Financeiro o gasto do mês de cada campanha ligada a um investimento.
 */
export async function sincronizarMeta(origem: 'manual' | 'cron', dias = 30) {
  const { token, conta, pronto } = configMeta()
  if (!pronto || !token || !conta) {
    throw new Error('Meta Ads não configurado: faltam META_ADS_TOKEN e/ou META_AD_ACCOUNT_ID na Vercel.')
  }
  try {
    const problema = diagnosticoToken(token)
    if (problema) throw new Error(`Token do Meta inválido: ${problema}. Gere de novo e cole só o token em META_ADS_TOKEN.`)
    const hoje = hojeBR()
    const desde = somarDias(hoje, -(dias - 1))

    const campanhas = await get(
      `act_${conta}/campaigns`,
      { fields: 'id,name,status,effective_status,objective,daily_budget', limit: '200' },
      token,
    )
    if (campanhas.length) {
      const { error } = await supabaseAdmin.from('admin_meta_campanhas').upsert(
        campanhas.map((c) => ({
          campaign_id: String(c.id),
          nome: String(c.name ?? ''),
          status: String(c.effective_status ?? c.status ?? ''),
          objetivo: c.objective ? String(c.objective) : null,
          // o Meta devolve o orçamento em centavos da moeda da conta
          orcamento_diario: c.daily_budget != null ? Number(c.daily_budget) / 100 : null,
          atualizado_em: new Date().toISOString(),
        })),
        { onConflict: 'campaign_id', ignoreDuplicates: false },
      )
      if (error) throw new Error(error.message)
    }

    const insights = await get(
      `act_${conta}/insights`,
      {
        level: 'campaign',
        time_increment: '1',
        time_range: JSON.stringify({ since: desde, until: hoje }),
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions',
        limit: '500',
      },
      token,
    )

    // Campanha que aparece só nos números (ex.: excluída) ainda precisa existir na tabela.
    const conhecidas = new Set(campanhas.map((c) => String(c.id)))
    const faltam = insights.filter((i) => !conhecidas.has(String(i.campaign_id)))
    if (faltam.length) {
      await supabaseAdmin.from('admin_meta_campanhas').upsert(
        [...new Map(faltam.map((i) => [String(i.campaign_id), { campaign_id: String(i.campaign_id), nome: String(i.campaign_name ?? ''), status: 'DELETED' }])).values()],
        { onConflict: 'campaign_id', ignoreDuplicates: true },
      )
    }

    const linhas = insights.map((i) => {
      const acoes = i.actions as Acao[] | undefined
      return {
        data: String(i.date_start),
        campaign_id: String(i.campaign_id),
        gasto: Number(i.spend ?? 0),
        impressoes: Number(i.impressions ?? 0),
        cliques: Number(i.clicks ?? 0),
        cliques_link: Number(i.inline_link_clicks ?? 0),
        leads_meta: somaAcoes(acoes, TIPOS_LEAD),
        conversas: somaAcoes(acoes, TIPOS_CONVERSA),
        bruto: i,
        atualizado_em: new Date().toISOString(),
      }
    })
    for (let k = 0; k < linhas.length; k += 500) {
      const { error } = await supabaseAdmin.from('admin_meta_insights').upsert(linhas.slice(k, k + 500), { onConflict: 'data,campaign_id' })
      if (error) throw new Error(error.message)
    }

    await atualizarGastoNoFinanceiro()
    await supabaseAdmin.from('admin_meta_sync').insert({ origem, ok: true, linhas: linhas.length, mensagem: `${campanhas.length} campanha(s)` })
    return { campanhas: campanhas.length, linhas: linhas.length }
  } catch (e) {
    await supabaseAdmin.from('admin_meta_sync').insert({ origem, ok: false, mensagem: (e as Error).message.slice(0, 500) })
    throw e
  }
}

/**
 * Para cada campanha ligada a um investimento, mantém um lançamento de saída por mês
 * ("Meta Ads — campanha — mm/aaaa") com o gasto real informado pelo Meta.
 * O lançamento é achado pela marca em `observacao` (meta:<campaign_id>:<aaaa-mm>).
 */
export async function atualizarGastoNoFinanceiro() {
  const { data: ligadas } = await supabaseAdmin
    .from('admin_meta_campanhas')
    .select('campaign_id, nome, investimento_id')
    .not('investimento_id', 'is', null)
  if (!ligadas?.length) return

  const hoje = hojeBR()
  for (const c of ligadas) {
    const { data: dias } = await supabaseAdmin.from('admin_meta_insights').select('data, gasto').eq('campaign_id', c.campaign_id).gt('gasto', 0)
    const porMes = new Map<string, { gasto: number; ultimo: string }>()
    for (const d of dias ?? []) {
      const mes = String(d.data).slice(0, 7)
      const atual = porMes.get(mes) ?? { gasto: 0, ultimo: '' }
      atual.gasto += Number(d.gasto)
      if (String(d.data) > atual.ultimo) atual.ultimo = String(d.data)
      porMes.set(mes, atual)
    }
    for (const [mes, v] of porMes) {
      const marca = `meta:${c.campaign_id}:${mes}`
      const valor = Math.round(v.gasto * 100) / 100
      if (valor <= 0) continue
      const [a, m] = mes.split('-')
      const registro = {
        tipo: 'saida',
        categoria: 'marketing',
        descricao: `Meta Ads — ${c.nome} — ${m}/${a}`,
        valor,
        data_prevista: `${mes}-01`,
        recorrencia: 'unica',
        status: 'realizado',
        data_realizada: v.ultimo > hoje ? hoje : v.ultimo,
        investimento_id: c.investimento_id,
        observacao: marca,
        criado_por: 'sincronização Meta Ads',
      }
      const { data: existe } = await supabaseAdmin.from('admin_fin_lancamentos').select('id').eq('observacao', marca).maybeSingle()
      if (existe) {
        await supabaseAdmin
          .from('admin_fin_lancamentos')
          .update({ valor, descricao: registro.descricao, data_realizada: registro.data_realizada, investimento_id: c.investimento_id, updated_at: new Date().toISOString() })
          .eq('id', existe.id)
      } else {
        await supabaseAdmin.from('admin_fin_lancamentos').insert(registro)
      }
    }
  }
}

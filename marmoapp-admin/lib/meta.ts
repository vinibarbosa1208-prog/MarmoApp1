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

// Para endpoints que devolvem um objeto só (ex.: a própria conta), não uma lista.
async function getObjeto(caminho: string, params: Record<string, string>, token: string) {
  const r = await fetch(`https://graph.facebook.com/${VERSAO}/${caminho}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) {
    const e = j.error ?? {}
    throw new Error(`Meta ${r.status}: ${e.message ?? 'erro desconhecido'}${e.code ? ` (código ${e.code})` : ''}`)
  }
  return j as Record<string, unknown>
}

// O Meta devolve valores de dinheiro da conta em centavos, como texto.
const centavos = (v: unknown) => (v == null || v === '' ? null : Number(v) / 100)

/**
 * Situação da conta, total já gasto, saldo a pagar, forma de pagamento e
 * cobranças recentes. Cada parte é opcional: se o token não tiver permissão
 * para algum campo, o resto continua.
 */
async function sincronizarConta(conta: string, token: string) {
  const base = 'name,account_status,disable_reason,currency,amount_spent,balance,spend_cap'
  let c: Record<string, unknown>
  try {
    c = await getObjeto(`act_${conta}`, { fields: `${base},funding_source_details` }, token)
  } catch {
    c = await getObjeto(`act_${conta}`, { fields: base }, token)
  }
  const fonte = c.funding_source_details as { display_string?: string; type?: number } | undefined

  let cobrancas: { data: string; tipo: string; valor: number | null }[] | null = null
  try {
    const atividades = await get(
      `act_${conta}/activities`,
      { fields: 'event_type,event_time,translated_event_type,extra_data', since: somarDias(hojeBR(), -90), limit: '200' },
      token,
    )
    cobrancas = atividades
      .filter((a) => String(a.event_type ?? '').includes('billing') || String(a.event_type ?? '').includes('funding'))
      .slice(0, 30)
      .map((a) => {
        let valor: number | null = null
        try {
          const extra = typeof a.extra_data === 'string' ? JSON.parse(a.extra_data) : a.extra_data
          const bruto = extra?.new_value ?? extra?.amount ?? extra?.charge_amount
          if (bruto != null && !Number.isNaN(Number(bruto))) valor = Number(bruto) / 100
        } catch {
          /* sem valor legível */
        }
        return { data: String(a.event_time ?? ''), tipo: String(a.translated_event_type ?? a.event_type ?? ''), valor }
      })
  } catch {
    cobrancas = null
  }


  const linha = {
    account_id: conta,
    nome: c.name ? String(c.name) : null,
    status: c.account_status != null ? Number(c.account_status) : null,
    motivo_bloqueio: c.disable_reason != null ? Number(c.disable_reason) : null,
    moeda: c.currency ? String(c.currency) : null,
    gasto_total: centavos(c.amount_spent),
    saldo: centavos(c.balance),
    limite_gasto: c.spend_cap && c.spend_cap !== '0' ? centavos(c.spend_cap) : null,
    forma_pagamento: fonte?.display_string ?? null,
    cobrancas,
    outras_contas: null,
    atualizado_em: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin.from('admin_meta_conta').upsert(linha, { onConflict: 'account_id' })
  if (error) throw new Error(error.message)
  return linha
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

/** Contas de anúncios que o token enxerga (a principal sempre primeiro). */
async function listarContas(principal: string, token: string) {
  const contas = [principal]
  try {
    const lista = await get('me/adaccounts', { fields: 'account_id', limit: '50' }, token)
    for (const a of lista) {
      const id = String(a.account_id ?? '').replace(/^act_/, '')
      if (id && !contas.includes(id)) contas.push(id)
    }
  } catch (e) {
    console.error('Meta: não deu para listar as contas', (e as Error).message)
  }
  return contas
}

const dataDe = (v: unknown) => (v ? String(v).slice(0, 10) : null)

/** Campanhas, números por dia e totais desde o início de UMA conta de anúncios. */
async function sincronizarUmaConta(conta: string, token: string, desde: string, hoje: string) {
  const campanhas = await get(
    `act_${conta}/campaigns`,
    { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time', limit: '200' },
    token,
  )
  if (campanhas.length) {
    const { error } = await supabaseAdmin.from('admin_meta_campanhas').upsert(
      campanhas.map((c) => ({
        campaign_id: String(c.id),
        account_id: conta,
        nome: String(c.name ?? ''),
        status: String(c.effective_status ?? c.status ?? ''),
        objetivo: c.objective ? String(c.objective) : null,
        // o Meta devolve o orçamento em centavos da moeda da conta
        orcamento_diario: c.daily_budget != null ? Number(c.daily_budget) / 100 : null,
        orcamento_total: c.lifetime_budget != null && c.lifetime_budget !== '0' ? Number(c.lifetime_budget) / 100 : null,
        inicio: dataDe(c.start_time),
        fim: dataDe(c.stop_time),
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

  // Totais desde o início de cada campanha (não depende da janela de dias).
  const totais = await get(
    `act_${conta}/insights`,
    { level: 'campaign', date_preset: 'maximum', fields: 'campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions', limit: '500' },
    token,
  )

  // Campanha que aparece só nos números (ex.: excluída) ainda precisa existir na tabela.
  const conhecidas = new Set(campanhas.map((c) => String(c.id)))
  const faltam = [...insights, ...totais].filter((i) => !conhecidas.has(String(i.campaign_id)))
  if (faltam.length) {
    await supabaseAdmin.from('admin_meta_campanhas').upsert(
      [...new Map(faltam.map((i) => [String(i.campaign_id), { campaign_id: String(i.campaign_id), account_id: conta, nome: String(i.campaign_name ?? ''), status: 'DELETED' }])).values()],
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

  for (const t of totais) {
    const acoes = t.actions as Acao[] | undefined
    const { error } = await supabaseAdmin
      .from('admin_meta_campanhas')
      .update({
        gasto_total: Number(t.spend ?? 0),
        impressoes_total: Number(t.impressions ?? 0),
        cliques_link_total: Number(t.inline_link_clicks ?? 0),
        leads_total: somaAcoes(acoes, TIPOS_LEAD),
        conversas_total: somaAcoes(acoes, TIPOS_CONVERSA),
      })
      .eq('campaign_id', String(t.campaign_id))
    if (error) throw new Error(error.message)
  }

  const info = await sincronizarConta(conta, token).catch((e: Error) => {
    console.error(`Meta: resumo da conta ${conta} falhou`, e.message)
    return null
  })

  return {
    campanhas: campanhas.length,
    linhas: linhas.length,
    gasto: totais.reduce((s, t) => s + Number(t.spend ?? 0), 0),
    nome: info?.nome ?? conta,
  }
}

/**
 * Busca, em todas as contas de anúncios que o token enxerga, campanhas, números por dia
 * dos últimos `dias` e totais desde o início, e grava no banco.
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

    const contas = await listarContas(conta, token)
    const resultados = []
    for (const c of contas) resultados.push(await sincronizarUmaConta(c, token, desde, hoje))

    await atualizarGastoNoFinanceiro()
    const linhas = resultados.reduce((s, r) => s + r.linhas, 0)
    const campanhas = resultados.reduce((s, r) => s + r.campanhas, 0)
    const gastoTotal = resultados.reduce((s, r) => s + r.gasto, 0)
    const mensagem = [
      `${contas.length} conta(s): ${resultados.map((r) => `${r.nome} R$ ${r.gasto.toFixed(2)}`).join(', ')}`,
      `${campanhas} campanha(s)`,
      `${linhas} linha(s) de números em ${dias} dias`,
    ].join(' · ')
    await supabaseAdmin.from('admin_meta_sync').insert({ origem, ok: true, linhas, mensagem: mensagem.slice(0, 500) })
    return { contas: contas.length, campanhas, linhas, gasto_total: gastoTotal }
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

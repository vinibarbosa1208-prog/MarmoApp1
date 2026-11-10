import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'

// Diagnósticos feitos na apresentação de vendas da MarmorarIA (/apresentacao).
// Cada salvamento cria ou atualiza o lead em `leads` e o diagnóstico em `diagnosticos`.

const DOR: Record<string, string> = { '1': 'orcamento', '2': 'prazo', '3': 'cobranca', '4': 'chapa' }
const PLANOS = ['gestao', 'operacao', 'crescimento']
const RESULTADOS = ['em_aberto', 'fechou', 'vai_pensar', 'perdido']
// leads.status aceita: novo, contactado, trial, convertido, perdido
const STATUS_LEAD: Record<string, string> = {
  em_aberto: 'contactado',
  vai_pensar: 'contactado',
  fechou: 'convertido',
  perdido: 'perdido',
}

type Estado = Record<string, unknown>

function texto(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t === '' ? null : t
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function inteiro(v: unknown): number | null {
  const n = numero(v)
  return n === null ? null : Math.round(n)
}

function uuid(v: unknown): string | null {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null
}

function soDigitos(v: string | null): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  return d.length >= 10 ? d : null
}

export async function GET(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = uuid(new URL(request.url).searchParams.get('id'))

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('diagnosticos')
      .select('id, lead_id, estado')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Diagnóstico não encontrado' }, { status: 404 })
    return NextResponse.json({
      diagnostico: { ...(data.estado as Estado), id: data.id, lead_id: data.lead_id },
    })
  }

  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, resultado, updated_at, leads(nome_marmoraria)')
    .order('updated_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const diagnosticos = (data ?? []).map((d) => {
    const lead = Array.isArray(d.leads) ? d.leads[0] : d.leads
    return {
      id: d.id,
      empresa: (lead as { nome_marmoraria?: string } | null)?.nome_marmoraria ?? '',
      resultado: d.resultado,
      updated_at: d.updated_at,
    }
  })
  return NextResponse.json({ diagnosticos })
}

export async function POST(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { estado?: Estado; calculo?: Estado }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const e = body.estado ?? {}
  const c = body.calculo ?? {}

  const empresa = texto(e.empresa)
  if (!empresa) return NextResponse.json({ error: 'Informe o nome da marmoraria' }, { status: 400 })

  const contato = texto(e.contato)
  const whatsapp = texto(e.whatsapp, 40)
  const email = texto(e.email, 200)
  const cidade = texto(e.cidade, 120)
  const resultado = RESULTADOS.includes(String(e.resultado)) ? String(e.resultado) : 'em_aberto'
  const agora = new Date().toISOString()

  // 1) Lead: usa o que veio da apresentação, ou acha pelo WhatsApp ou pelo nome.
  let leadId = uuid(e.lead_id)
  if (!leadId) {
    const digitos = soDigitos(whatsapp)
    if (digitos) {
      const { data } = await supabaseAdmin
        .from('leads')
        .select('id, whatsapp')
        .not('whatsapp', 'is', null)
        .limit(1000)
      leadId = (data ?? []).find((l) => soDigitos(l.whatsapp)?.endsWith(digitos.slice(-10)))?.id ?? null
    }
    if (!leadId) {
      const { data } = await supabaseAdmin
        .from('leads')
        .select('id')
        .ilike('nome_marmoraria', empresa.replace(/[%_]/g, ''))
        .limit(1)
      leadId = data?.[0]?.id ?? null
    }
  }

  const dadosLead = {
    nome_marmoraria: empresa,
    nome_contato: contato ?? empresa,
    whatsapp,
    email,
    cidade,
    tamanho_equipe: e.equipe ? String(e.equipe).slice(0, 20) : null,
    status: STATUS_LEAD[resultado],
    updated_at: agora,
  }

  if (leadId) {
    const { error } = await supabaseAdmin.from('leads').update(dadosLead).eq('id', leadId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ ...dadosLead, origem: 'diagnostico_call', utm_campaign: 'marmoraria-ia-nov26' })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    leadId = data.id
  }

  // 2) Diagnóstico com os números da call.
  const plano = PLANOS.includes(String(c.plano)) ? String(c.plano) : null
  const estado: Estado = { ...e, lead_id: leadId }
  delete estado.id
  const diag = {
    lead_id: leadId,
    data_call: typeof e.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.data) ? e.data : null,
    dor: DOR[String(c.dor ?? e.dor)] ?? null,
    equipe: inteiro(e.equipe),
    orcamentos_mes: inteiro(e.orc),
    fechados_mes: inteiro(e.fech),
    valor_medio: numero(e.medio),
    taxa_fechamento: inteiro(c.taxa_fechamento),
    obras_fila: inteiro(e.fila),
    obras_atrasadas_mes: inteiro(e.atr),
    sabe_entregas: e.sabe === 'sim' ? true : e.sabe === 'não' ? false : null,
    faltas_chapa_mes: inteiro(e.falta),
    custo_extra_falta: numero(e.cf),
    a_receber: numero(e.receber),
    a_receber_vencido: numero(e.venc),
    obras_sem_cobranca: numero(e.semcob),
    valor_na_mesa: numero(c.valor_na_mesa),
    valor_total: numero(c.valor_total),
    plano_recomendado: plano,
    resultado,
    observacoes: texto(e.obs, 4000),
    estado,
    criado_por: user.email ?? null,
    updated_at: agora,
  }

  const diagId = uuid(e.id)
  if (diagId) {
    const { data, error } = await supabaseAdmin
      .from('diagnosticos')
      .update(diag)
      .eq('id', diagId)
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) return NextResponse.json({ id: data.id, lead_id: leadId })
  }

  const { data, error } = await supabaseAdmin.from('diagnosticos').insert(diag).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, lead_id: leadId })
}

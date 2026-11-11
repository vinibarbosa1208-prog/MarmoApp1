import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ALLOWED_ADMIN_EMAILS } from '@/lib/types'

// Formulário público de pré-diagnóstico da MarmorarIA (marmoapp.com/marmoraria-ia/diagnostico).
// O lead responde faturamento médio e número de funcionários; a rota diz se a marmoraria
// se encaixa, grava o lead e um diagnóstico em aberto (que a apresentação abre preenchido)
// e avisa o Vinicius por e-mail.

const FATURAMENTO: Record<string, { label: string; pontos: number; nivel: number }> = {
  ate_15: { label: 'até R$ 15 mil', pontos: 0, nivel: 0 },
  '15_40': { label: 'R$ 15 mil a R$ 40 mil', pontos: 15, nivel: 1 },
  '40_80': { label: 'R$ 40 mil a R$ 80 mil', pontos: 30, nivel: 2 },
  '80_150': { label: 'R$ 80 mil a R$ 150 mil', pontos: 40, nivel: 3 },
  '150_300': { label: 'R$ 150 mil a R$ 300 mil', pontos: 45, nivel: 4 },
  '300_mais': { label: 'acima de R$ 300 mil', pontos: 45, nivel: 5 },
}
const EQUIPE: Record<string, { label: string; pessoas: number; pontos: number }> = {
  '1_2': { label: '1 a 2 pessoas', pessoas: 2, pontos: 0 },
  '3_5': { label: '3 a 5 pessoas', pessoas: 4, pontos: 15 },
  '6_10': { label: '6 a 10 pessoas', pessoas: 8, pontos: 25 },
  '11_20': { label: '11 a 20 pessoas', pessoas: 15, pontos: 30 },
  '20_mais': { label: 'mais de 20 pessoas', pessoas: 25, pontos: 30 },
}
const PRAZO: Record<string, { label: string; pontos: number }> = {
  agora: { label: 'agora, este mês', pontos: 15 },
  tres_meses: { label: 'nos próximos 3 meses', pontos: 8 },
  pesquisando: { label: 'só estou pesquisando', pontos: 0 },
}
const DOR: Record<string, { codigo: string; label: string }> = {
  '1': { codigo: 'orcamento', label: 'orçamento que o cliente some' },
  '2': { codigo: 'prazo', label: 'prazo e produção' },
  '3': { codigo: 'cobranca', label: 'cobrança e caixa' },
  '4': { codigo: 'chapa', label: 'chapa e insumo que faltam' },
}

const ORIGENS = [/^https:\/\/(www\.)?marmoapp\.com$/, /^https:\/\/marmoapp-landing-[a-z0-9-]+\.vercel\.app$/]

function cors(origin: string | null): Record<string, string> {
  const ok = origin && ORIGENS.some((r) => r.test(origin))
  return ok
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' }
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max)
  return t === '' ? null : t
}

function digitos(v: string | null): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 13 ? d : null
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get('origin')) })
}

export async function POST(request: NextRequest) {
  const headers = cors(request.headers.get('origin'))
  const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status, headers })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return erro('Não consegui ler o formulário.')
  }

  // Campo escondido: gente não preenche, robô sim. Responde como se tivesse dado certo.
  if (texto(b.site, 100)) return NextResponse.json({ ok: true, encaixe: 'gestao' }, { headers })

  const nome = texto(b.nome, 80)
  const empresa = texto(b.empresa, 120)
  const cidade = texto(b.cidade, 80)
  const whatsapp = texto(b.whatsapp, 30)
  const zap = digitos(whatsapp)
  const fat = FATURAMENTO[String(b.faturamento)]
  const eq = EQUIPE[String(b.equipe)]
  const prazo = PRAZO[String(b.prazo)] ?? null
  const dorKey = DOR[String(b.dor)] ? String(b.dor) : ''

  if (!nome || !empresa) return erro('Preencha seu nome e o nome da marmoraria.')
  if (!zap) return erro('Confira o WhatsApp, com DDD.')
  if (!fat || !eq) return erro('Escolha o faturamento e o número de pessoas.')

  // Limite simples contra envio em massa.
  const dezMin = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('origem', 'formulario_diagnostico')
    .gte('created_at', dezMin)
  if ((count ?? 0) > 30) return erro('Muitos envios agora. Tente de novo em alguns minutos.', 429)

  // Encaixe: agência (Operação com IA) a partir de 3 pessoas e R$ 40 mil/mês;
  // Gestão com IA a partir de R$ 15 mil/mês; abaixo disso, ainda é cedo.
  const encaixe = eq.pessoas >= 3 && fat.nivel >= 2 ? 'agencia' : fat.nivel >= 1 ? 'gestao' : 'cedo'
  const score = Math.min(100, fat.pontos + eq.pontos + (prazo?.pontos ?? 0) + (dorKey ? 10 : 0))
  const agora = new Date().toISOString()
  const utm = (k: string) => texto(b[k], 100)

  // Lead: reaproveita o mesmo WhatsApp se ele já existir.
  const { data: existentes } = await supabaseAdmin
    .from('leads')
    .select('id, whatsapp')
    .not('whatsapp', 'is', null)
    .limit(2000)
  let leadId = (existentes ?? []).find((l) => digitos(l.whatsapp)?.slice(-10) === zap.slice(-10))?.id ?? null

  const dadosLead = {
    nome_contato: nome,
    nome_marmoraria: empresa,
    whatsapp,
    cidade,
    tamanho_equipe: eq.label,
    updated_at: agora,
  }
  if (leadId) {
    const { error } = await supabaseAdmin.from('leads').update(dadosLead).eq('id', leadId)
    if (error) return erro('Não consegui salvar agora. Tente de novo.', 500)
  } else {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({
        ...dadosLead,
        origem: 'formulario_diagnostico',
        status: 'novo',
        utm_source: utm('utm_source'),
        utm_medium: utm('utm_medium'),
        utm_campaign: utm('utm_campaign') ?? 'marmoraria-ia-nov26',
      })
      .select('id')
      .single()
    if (error || !data) return erro('Não consegui salvar agora. Tente de novo.', 500)
    leadId = data.id
  }

  // Diagnóstico em aberto, já com o que o lead respondeu (a apresentação abre preenchida).
  const estado = {
    empresa,
    contato: nome,
    cidade: cidade ?? '',
    whatsapp,
    equipe: eq.pessoas,
    equipe_faixa: eq.label,
    faturamento: String(b.faturamento),
    faturamento_faixa: fat.label,
    prazo: prazo ? String(b.prazo) : '',
    dor: dorKey,
    encaixe,
    score,
    origem_formulario: true,
    resultado: 'em_aberto',
    lead_id: leadId,
  }
  const { data: aberto } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, estado')
    .eq('lead_id', leadId)
    .eq('resultado', 'em_aberto')
    .order('updated_at', { ascending: false })
    .limit(1)
  const diag = {
    lead_id: leadId,
    dor: dorKey ? DOR[dorKey].codigo : null,
    equipe: eq.pessoas,
    estado: { ...((aberto?.[0]?.estado as object) ?? {}), ...estado },
    updated_at: agora,
  }
  const { error: errDiag } = aberto?.[0]
    ? await supabaseAdmin.from('diagnosticos').update(diag).eq('id', aberto[0].id)
    : await supabaseAdmin.from('diagnosticos').insert({ ...diag, resultado: 'em_aberto', criado_por: 'formulario' })
  if (errDiag) return erro('Não consegui salvar agora. Tente de novo.', 500)

  // Aviso para responder rápido. Falha no e-mail não impede o lead de seguir.
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const rotulo = { agencia: 'ENCAIXA no MarmoApp Plus', gestao: 'MarmoApp', cedo: 'ainda cedo' }[encaixe]
      await resend.emails.send({
        from: 'MarmorarIA <onboarding@marmoapp.com>',
        to: ALLOWED_ADMIN_EMAILS[0],
        subject: `Novo lead (${score}/100, ${rotulo}): ${empresa}`,
        text: [
          `${nome} — ${empresa}${cidade ? ` (${cidade})` : ''}`,
          `WhatsApp: ${whatsapp}`,
          `Faturamento médio: ${fat.label}`,
          `Equipe: ${eq.label}`,
          `Quer resolver: ${prazo?.label ?? 'não respondeu'}`,
          `Maior dor: ${dorKey ? DOR[dorKey].label : 'não respondeu'}`,
          `Encaixe: ${rotulo} · nota ${score}/100`,
          '',
          'Abra em admin.marmoapp.com/apresentacao (já está na lista de clientes).',
        ].join('\n'),
      })
    } catch {
      // segue sem o aviso
    }
  }

  return NextResponse.json({ ok: true, encaixe, primeiro_nome: nome.split(' ')[0] }, { headers })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { apiSupabase } from '@/lib/api-auth'
import { asaas, documentoValido, hojeSP, soDigitos, VALOR_MARMOAPP } from '@/lib/asaas'

// Cria (ou retoma) a assinatura do plano MarmoApp no Asaas e devolve o link da fatura,
// onde o cliente paga por Pix, boleto ou cartão. O acesso é liberado pelo webhook.

async function usuarioLogado() {
  const cookieStore = await cookies()
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
  const { data: { user } } = await sb.auth.getUser()
  return user
}

type Marmoraria = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cnpj: string | null
  plano: string | null
  trial_expira: string | null
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
}

const CAMPOS = 'id, nome, email, telefone, cnpj, plano, trial_expira, asaas_customer_id, asaas_subscription_id'

export async function POST(req: NextRequest) {
  try {
    const user = await usuarioLogado()
    if (!user) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as {
      nome?: string; cnpj?: string; telefone?: string; cidade?: string; email?: string
    }

    let { data: m } = await apiSupabase.from('marmorarias').select(CAMPOS).eq('owner_id', user.id).maybeSingle<Marmoraria>()

    if (!m) {
      if (!body.nome?.trim()) return NextResponse.json({ error: 'Marmoraria não encontrada.' }, { status: 404 })
      const { data: nova, error } = await apiSupabase
        .from('marmorarias')
        .insert({
          owner_id: user.id,
          nome: body.nome.trim(),
          cnpj: body.cnpj || null,
          telefone: body.telefone || null,
          cidade: body.cidade || null,
          email: body.email || user.email,
          plano: 'pro',
          trial_expira: null, // preenchido pelo webhook quando o pagamento é confirmado
          setup_concluido: true,
        })
        .select(CAMPOS)
        .single<Marmoraria>()
      if (error || !nova) {
        console.error('[asaas/assinar] insert marmoraria:', error?.message)
        return NextResponse.json({ error: 'Erro ao criar a marmoraria.' }, { status: 500 })
      }
      m = nova
    }

    // Já pagou (ou foi liberada pelo time): nada a cobrar.
    if (m.trial_expira && m.plano && m.plano !== 'trial') return NextResponse.json({ url: '/dashboard' })

    const doc = soDigitos(body.cnpj || m.cnpj)
    if (!documentoValido(doc)) {
      return NextResponse.json({ error: 'Informe o CPF ou CNPJ para emitir a cobrança.', precisaDocumento: true }, { status: 400 })
    }
    if (soDigitos(m.cnpj) !== doc) await apiSupabase.from('marmorarias').update({ cnpj: body.cnpj }).eq('id', m.id)

    let clienteId = m.asaas_customer_id
    if (!clienteId) {
      const tel = soDigitos(body.telefone || m.telefone).slice(-11)
      const c = await asaas<{ id: string }>('POST', '/customers', {
        name: m.nome,
        cpfCnpj: doc,
        email: m.email || user.email || undefined,
        mobilePhone: tel.length >= 10 ? tel : undefined,
        externalReference: m.id,
      })
      clienteId = c.id
      await apiSupabase.from('marmorarias').update({ asaas_customer_id: clienteId }).eq('id', m.id)
    }

    let assinaturaId = m.asaas_subscription_id
    if (!assinaturaId) {
      const s = await asaas<{ id: string }>('POST', '/subscriptions', {
        customer: clienteId,
        billingType: 'UNDEFINED', // o cliente escolhe Pix, boleto ou cartão na fatura
        value: VALOR_MARMOAPP,
        nextDueDate: hojeSP(),
        cycle: 'MONTHLY',
        description: 'MarmoApp: assinatura mensal (sem fidelidade)',
        externalReference: m.id,
      })
      assinaturaId = s.id
      await apiSupabase.from('marmorarias').update({ asaas_subscription_id: assinaturaId }).eq('id', m.id)
    }

    type Lista = { data: { invoiceUrl: string; status: string }[] }
    let faturas = await asaas<Lista>('GET', `/subscriptions/${assinaturaId}/payments?status=PENDING`)
    if (!faturas.data?.length) faturas = await asaas<Lista>('GET', `/subscriptions/${assinaturaId}/payments?status=OVERDUE`)
    const url = faturas.data?.[0]?.invoiceUrl
    if (!url) return NextResponse.json({ error: 'A cobrança ainda está sendo gerada. Tente de novo em instantes.' }, { status: 503 })

    return NextResponse.json({ url })
  } catch (e) {
    console.error('[asaas/assinar]', e)
    return NextResponse.json({ error: (e as Error).message || 'Erro ao gerar a cobrança.' }, { status: 500 })
  }
}

import { requireAdminAuth } from '@/lib/auth-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Header from '@/components/Header'
import ContratoEditor, { type Inicial } from '../ContratoEditor'

// Novo contrato. Com ?diagnostico=<id>, já vem preenchido com a marmoraria da call.
export default async function NovoContratoPage({ searchParams }: { searchParams: Promise<{ diagnostico?: string }> }) {
  await requireAdminAuth()
  const { diagnostico } = await searchParams

  const inicial: Inicial = {}
  if (diagnostico && /^[0-9a-f-]{36}$/i.test(diagnostico)) {
    const { data } = await supabaseAdmin
      .from('diagnosticos')
      .select('id, lead_id, plano_recomendado, estado, leads(nome_marmoraria, nome_contato, whatsapp, email, cidade)')
      .eq('id', diagnostico)
      .maybeSingle()
    if (data) {
      const lead = (Array.isArray(data.leads) ? data.leads[0] : data.leads) as Record<string, string | null> | null
      const e = (data.estado ?? {}) as Record<string, string>
      inicial.diagnostico_id = data.id
      inicial.lead_id = data.lead_id
      inicial.plano = (data.plano_recomendado as Inicial['plano']) ?? undefined
      inicial.contratante = {
        razao_social: lead?.nome_marmoraria ?? e.empresa ?? '',
        representante: lead?.nome_contato ?? e.contato ?? '',
        whatsapp: lead?.whatsapp ?? e.whatsapp ?? '',
        email: lead?.email ?? e.email ?? '',
        cidade: lead?.cidade ?? e.cidade ?? '',
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Novo contrato" subtitle="Preencha, confira a prévia e envie para assinatura" />
      <div className="flex-1 overflow-auto p-6">
        <ContratoEditor inicial={inicial} />
      </div>
    </div>
  )
}

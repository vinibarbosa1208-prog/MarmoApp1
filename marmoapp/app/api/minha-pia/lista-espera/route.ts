import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getProgramadoMarmorariaId, errMsg } from '@/lib/minha-pia/servidor'
import { soDigitos, whatsappValido } from '@/lib/minha-pia/regras'

// POST público — quem está fora da área entra na lista de espera
// (base para escolher as próximas regiões / marmorarias parceiras).
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}))
    const nome = typeof b.nome === 'string' ? b.nome.trim().slice(0, 120) : ''
    const whatsapp = soDigitos(b.whatsapp)
    const cidade = typeof b.cidade === 'string' ? b.cidade.trim().slice(0, 80) : ''
    if (!nome || !cidade || !whatsappValido(whatsapp)) return NextResponse.json({ error: 'Preencha nome, WhatsApp e cidade.' }, { status: 400 })
    const utm = (b.utm && typeof b.utm === 'object') ? b.utm as Record<string, string> : {}
    const { error } = await supabase.from('programado_lista_espera').insert({
      marmoraria_id: getProgramadoMarmorariaId(), nome, whatsapp, cidade,
      kit_codigo: typeof b.kit_codigo === 'string' ? b.kit_codigo.slice(0, 60) : null,
      utm_source: utm.utm_source?.slice(0, 100) || null, utm_campaign: utm.utm_campaign?.slice(0, 150) || null,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

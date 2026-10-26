import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getProgramadoMarmorariaId, conferePin, abrirSessao, errMsg, MAX_TENTATIVAS_PIN, BLOQUEIO_PIN_MIN } from '@/lib/minha-pia/servidor'
import { soDigitos } from '@/lib/minha-pia/regras'

// POST público — CPF + PIN. Bloqueia por 15 min após 5 erros seguidos.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}))
    const cpf = soDigitos(b.cpf)
    const pin = typeof b.pin === 'string' ? b.pin : ''
    const erroGenerico = NextResponse.json({ error: 'CPF ou PIN incorretos.' }, { status: 401 })
    if (cpf.length !== 11 || !/^\d{4}$/.test(pin)) return erroGenerico

    const { data: a } = await supabase.from('programado_adesoes')
      .select('id, pin_hash, pin_tentativas, pin_bloqueado_ate')
      .eq('marmoraria_id', getProgramadoMarmorariaId()).eq('cpf', cpf)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!a) return erroGenerico

    if (a.pin_bloqueado_ate && new Date(a.pin_bloqueado_ate) > new Date()) {
      return NextResponse.json({ error: `Muitas tentativas. Tente de novo em ${BLOQUEIO_PIN_MIN} minutos ou fale com a gente no WhatsApp.` }, { status: 429 })
    }

    if (!(await conferePin(pin, a.pin_hash))) {
      const tentativas = (a.pin_tentativas ?? 0) + 1
      await supabase.from('programado_adesoes').update({
        pin_tentativas: tentativas >= MAX_TENTATIVAS_PIN ? 0 : tentativas,
        pin_bloqueado_ate: tentativas >= MAX_TENTATIVAS_PIN ? new Date(Date.now() + BLOQUEIO_PIN_MIN * 60_000).toISOString() : null,
      }).eq('id', a.id)
      return erroGenerico
    }

    await supabase.from('programado_adesoes').update({ pin_tentativas: 0, pin_bloqueado_ate: null }).eq('id', a.id)
    await abrirSessao(a.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[minha-pia/entrar]', errMsg(e))
    return NextResponse.json({ error: 'Não foi possível entrar agora.' }, { status: 500 })
  }
}

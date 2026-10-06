import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { segundaDaSemana } from '@/lib/producao/semana'
import { carregarPessoas, validarSemana } from '@/lib/producao/ficha-server'

// Geração automática das fichas da semana — mesmo ritmo da presença: uma
// semana por vez, uma linha por pessoa.
//
// Dois chamadores:
//  1. Vercel Cron, toda segunda às 05:00 (BRT = 08:00 UTC), com
//     `Authorization: Bearer $CRON_SECRET` — roda pra TODAS as marmorarias.
//  2. A tela da ficha, se for aberta antes do cron rodar — roda só pro
//     tenant da sessão. `garantirFicha` já cria sob demanda por pessoa;
//     isso aqui adianta a semana inteira de uma vez.
//
// Idempotente: a unicidade (pessoa_id, semana_inicio) garante que rodar
// duas vezes não duplica nada.

export const dynamic = 'force-dynamic'

async function gerarParaTenant(marmoraria_id: string, semana_inicio: string) {
  const pessoas = await carregarPessoas(marmoraria_id)
  if (pessoas.length === 0) return { criadas: 0, pessoas: 0 }

  const { data: existentes } = await supabase
    .from('fichas_producao')
    .select('pessoa_id')
    .eq('marmoraria_id', marmoraria_id)
    .eq('semana_inicio', semana_inicio)

  const jaTem = new Set((existentes ?? []).map(f => f.pessoa_id))
  const novas = pessoas
    .filter(p => !jaTem.has(p.pessoaId))
    .map(p => ({ marmoraria_id, pessoa_id: p.pessoaId, semana_inicio }))

  if (novas.length === 0) return { criadas: 0, pessoas: pessoas.length }

  const { error } = await supabase.from('fichas_producao').insert(novas)
  // Corrida com a tela abrindo no mesmo instante: a unicidade recusa o
  // segundo insert e isso é sucesso, não erro.
  if (error && !/duplicate key|unique/i.test(error.message)) throw error

  return { criadas: novas.length, pessoas: pessoas.length }
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const auth = req.headers.get('authorization')
    const ehCron = !!cronSecret && auth === `Bearer ${cronSecret}`

    // A semana pode vir no corpo (lançamento retroativo de uma semana
    // antiga); por padrão, a semana corrente.
    let semana_inicio = segundaDaSemana()
    if (!ehCron) {
      const body = await req.json().catch(() => ({}))
      if (body?.semana) {
        const v = validarSemana(String(body.semana))
        if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
        semana_inicio = v.semana
      }
    }

    if (ehCron) {
      const { data: marmorarias, error } = await supabase
        .from('marmorarias')
        .select('id')
        .eq('ativo', true)
      if (error) throw error

      let criadas = 0
      const falhas: string[] = []
      for (const m of marmorarias ?? []) {
        try {
          const r = await gerarParaTenant(m.id, semana_inicio)
          criadas += r.criadas
        } catch (e) {
          // Um tenant com cadastro inconsistente não pode impedir os outros.
          console.error('[fichas/gerar-semana] falhou para marmoraria', m.id, e)
          falhas.push(m.id)
        }
      }
      return NextResponse.json({ ok: true, semana_inicio, criadas, tenants: (marmorarias ?? []).length, falhas })
    }

    const marmoraria_id = await getMarmorariaId(auth)
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const r = await gerarParaTenant(marmoraria_id, semana_inicio)
    return NextResponse.json({ ok: true, semana_inicio, ...r })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[fichas/gerar-semana] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// O Vercel Cron chama com GET em alguns setups; aceita os dois.
export async function GET(req: NextRequest) {
  return POST(req)
}

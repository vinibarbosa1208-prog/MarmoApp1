import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { segundaDaSemana } from '@/lib/producao/semana'

// Seletor de semana da tela da ficha: todas as semanas que já existem
// (fichas geradas) mais a corrente, da mais recente pra trás, com o status
// agregado — semana fechada abre somente leitura.

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('fichas_producao')
      .select('semana_inicio, status')
      .eq('marmoraria_id', marmoraria_id)
      .order('semana_inicio', { ascending: false })
    if (error) throw error

    const porSemana = new Map<string, { abertas: number; fechadas: number }>()
    for (const f of data ?? []) {
      const acc = porSemana.get(f.semana_inicio) ?? { abertas: 0, fechadas: 0 }
      if (f.status === 'fechada') acc.fechadas++; else acc.abertas++
      porSemana.set(f.semana_inicio, acc)
    }

    // A semana corrente sempre aparece, mesmo antes do cron rodar.
    const corrente = segundaDaSemana()
    if (!porSemana.has(corrente)) porSemana.set(corrente, { abertas: 0, fechadas: 0 })

    const semanas = [...porSemana.entries()]
      .map(([semana_inicio, acc]) => ({
        semana_inicio,
        // Só é "fechada" quando nenhuma ficha da semana ficou aberta.
        status: acc.fechadas > 0 && acc.abertas === 0 ? 'fechada' : 'aberta',
        fichas: acc.abertas + acc.fechadas,
      }))
      .sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio))

    return NextResponse.json({ semanas, corrente })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[fichas/semanas] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

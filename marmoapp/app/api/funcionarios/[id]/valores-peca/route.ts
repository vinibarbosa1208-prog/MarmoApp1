import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Valores padronizados por instalador + tipo de peça (R$/metro linear) —
// melhora o pré-preenchimento no portal, mas o campo lá continua editável.
// Granularidade por instalador porque velocidade/habilidade varia de
// pessoa pra pessoa (decisão confirmada com o cliente).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { data: funcionario, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()
    if (funcErr) throw funcErr
    if (!funcionario) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('funcionario_valores_peca')
      .select('tipo_peca, valor_metro_linear')
      .eq('funcionario_id', id)
      .eq('marmoraria_id', marmoraria_id)
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Substitui o conjunto inteiro de valores desse funcionário pelo enviado —
// tipo_peca que não vier no corpo é removido (o gestor limpou o campo na
// UI, volta a cair no valor_metro_linear fixo do cadastro).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const { data: funcionario, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()
    if (funcErr) throw funcErr
    if (!funcionario) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

    const body = await req.json()
    const valoresRecebidos: { tipo_peca?: unknown; valor_metro_linear?: unknown }[] = Array.isArray(body.valores) ? body.valores : []

    const valores = valoresRecebidos
      .filter((v): v is { tipo_peca: string; valor_metro_linear: number } =>
        typeof v.tipo_peca === 'string' && v.tipo_peca.trim().length > 0 &&
        typeof v.valor_metro_linear === 'number' && v.valor_metro_linear > 0
      )
      .map(v => ({ tipo_peca: v.tipo_peca, valor_metro_linear: v.valor_metro_linear }))

    const tiposValidos = valores.map(v => v.tipo_peca)

    // Remove os que não vieram (foram limpos na UI)
    let deleteQuery = supabase.from('funcionario_valores_peca').delete().eq('funcionario_id', id).eq('marmoraria_id', marmoraria_id)
    deleteQuery = tiposValidos.length > 0 ? deleteQuery.not('tipo_peca', 'in', `(${tiposValidos.join(',')})`) : deleteQuery
    const { error: delErr } = await deleteQuery
    if (delErr) throw delErr

    if (valores.length > 0) {
      const { error: upsertErr } = await supabase
        .from('funcionario_valores_peca')
        .upsert(
          valores.map(v => ({ marmoraria_id, funcionario_id: id, tipo_peca: v.tipo_peca, valor_metro_linear: v.valor_metro_linear })),
          { onConflict: 'funcionario_id,tipo_peca' }
        )
      if (upsertErr) throw upsertErr
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

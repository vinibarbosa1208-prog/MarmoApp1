import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, getAuthUserId, apiSupabase as supabase } from '@/lib/api-auth'

// Rejeita um apontamento (ex: foto não confere, metro errado) — não gera
// pagamento nem funcionario_instalacoes. O instalador continua vendo a
// peça como "instalada" (fisicamente já foi), só não entra no fechamento;
// se quiser corrigir, hoje precisa ser um novo registro — não há reabertura.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const usuario_id = await getAuthUserId()
    if (!usuario_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const apontamento_id = String(body.apontamento_id ?? '')
    if (!apontamento_id) return NextResponse.json({ error: 'apontamento_id obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('producao_apontamentos')
      .update({ status: 'rejeitado', aprovado_por: usuario_id, aprovado_em: new Date().toISOString() })
      .eq('id', apontamento_id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('status', 'pendente')
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Apontamento não encontrado ou já processado' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

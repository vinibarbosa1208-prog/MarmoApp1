import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

// Confirma que o id escolhido na tela de identificação é mesmo um
// instalador ativo dessa marmoraria antes de devolver qualquer coisa —
// sem isso, alguém poderia passar qualquer uuid na URL.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const marmoraria_id = getPortalMarmorariaId()

    const { data, error } = await supabase
      .from('funcionarios')
      .select('id, nome, valor_metro_linear')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', 'instalador')
      .eq('ativo', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Instalador não encontrado' }, { status: 404 })

    // Valores padronizados por tipo de peça (fase 12) — pré-preenchem o
    // campo do portal por peça; quando não há um específico, o front cai
    // no valor_metro_linear geral acima.
    const { data: valoresPeca, error: valoresErr } = await supabase
      .from('funcionario_valores_peca')
      .select('tipo_peca, valor_metro_linear')
      .eq('funcionario_id', id)
      .eq('marmoraria_id', marmoraria_id)
    if (valoresErr) throw valoresErr

    const valores_peca = Object.fromEntries((valoresPeca ?? []).map(v => [v.tipo_peca, v.valor_metro_linear]))

    return NextResponse.json({ ...data, valores_peca })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Fechamento semanal (gestor): lista os apontamentos de instalação
// pendentes de aprovação numa semana, agrupáveis por instalador no
// front. Cobre tanto obras do sistema quanto retroativas/avulsas.
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semana = req.nextUrl.searchParams.get('semana')
    if (!semana) return NextResponse.json({ error: 'Parâmetro semana obrigatório' }, { status: 400 })
    const fim = new Date(semana + 'T00:00:00')
    fim.setDate(fim.getDate() + 7)

    const { data: apontamentos, error } = await supabase
      .from('producao_apontamentos')
      .select('id, funcionario_id, orcamento_id, orcamento_item_id, quantidade, unidade, data, foto_storage_path, valor_calculado, valor_metro_linear_aplicado, obra_nome_avulso, obra_local_avulso, is_retroativo, funcionarios(id, nome, valor_metro_linear)')
      .eq('marmoraria_id', marmoraria_id)
      .eq('etapa', 'instalacao')
      .eq('status', 'pendente')
      .gte('data', semana)
      .lt('data', fim.toISOString().split('T')[0])
      .order('data', { ascending: true })
    if (error) throw error

    const orcamentoIds = [...new Set((apontamentos ?? []).map(a => a.orcamento_id).filter((v): v is string => !!v))]
    const itemIds = [...new Set((apontamentos ?? []).map(a => a.orcamento_item_id).filter((v): v is string => !!v))]

    const [{ data: orcamentos }, { data: itens }] = await Promise.all([
      orcamentoIds.length
        ? supabase.from('orcamentos').select('id, numero_os, titulo').in('id', orcamentoIds)
        : Promise.resolve({ data: [] as { id: string; numero_os: string | null; titulo: string | null }[] }),
      itemIds.length
        ? supabase.from('orcamento_itens').select('id, descricao').in('id', itemIds)
        : Promise.resolve({ data: [] as { id: string; descricao: string }[] }),
    ])
    const orcamentosById = new Map((orcamentos ?? []).map(o => [o.id, o]))
    const itensById = new Map((itens ?? []).map(i => [i.id, i]))

    // Signed URLs pras fotos — bucket privado, nunca serve caminho cru.
    const fotoUrls = new Map<string, string>()
    for (const a of apontamentos ?? []) {
      if (!a.foto_storage_path || fotoUrls.has(a.foto_storage_path)) continue
      const { data } = await supabase.storage.from('comprovantes-instalacao').createSignedUrl(a.foto_storage_path, 3600)
      if (data?.signedUrl) fotoUrls.set(a.foto_storage_path, data.signedUrl)
    }

    const resultado = (apontamentos ?? []).map(a => ({
      id: a.id,
      funcionario: a.funcionarios,
      data: a.data,
      metros_lineares: a.quantidade,
      valor_calculado: a.valor_calculado,
      valor_metro_linear_aplicado: a.valor_metro_linear_aplicado,
      is_retroativo: a.is_retroativo,
      obra: a.is_retroativo
        ? { nome: a.obra_nome_avulso, local: a.obra_local_avulso }
        : { numero_os: a.orcamento_id ? orcamentosById.get(a.orcamento_id)?.numero_os ?? null : null, titulo: a.orcamento_id ? orcamentosById.get(a.orcamento_id)?.titulo ?? null : null },
      item_descricao: a.orcamento_item_id ? itensById.get(a.orcamento_item_id)?.descricao ?? null : null,
      foto_url: a.foto_storage_path ? fotoUrls.get(a.foto_storage_path) ?? null : null,
    }))

    return NextResponse.json(resultado)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

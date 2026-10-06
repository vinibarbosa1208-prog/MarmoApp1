import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { fimExclusivoDaSemana } from '@/lib/producao/semana'
import { carregarPessoas, validarSemana } from '@/lib/producao/ficha-server'

// Dados do PDF da ficha semanal. O PDF em si é montado no navegador
// (jsPDF, mesmo padrão dos outros geradores do app) — aqui só sai o que
// imprimir: uma entrada por PESSOA (não por cadastro), já no modelo certo.
//
// `?preenchida=1` acrescenta as linhas digitadas da semana, pra o
// "🖨️ Imprimir ficha preenchida" do histórico servir de conferência.

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const semanaParam = validarSemana(req.nextUrl.searchParams.get('semana'))
    if (!semanaParam.ok) return NextResponse.json({ error: semanaParam.erro }, { status: 400 })
    const semana = semanaParam.semana

    const preenchida = req.nextUrl.searchParams.get('preenchida') === '1'
    const sóPessoa = req.nextUrl.searchParams.get('pessoa')

    // Ficha em branco: só gente ativa. Ficha preenchida do histórico:
    // inclui inativos, senão a semana de quem saiu sai sem a folha dele.
    let pessoas = await carregarPessoas(marmoraria_id, { incluirInativos: preenchida })
    if (sóPessoa) pessoas = pessoas.filter(p => p.pessoaId === sóPessoa)

    const { data: marmoraria } = await supabase
      .from('marmorarias').select('nome').eq('id', marmoraria_id).maybeSingle()

    const base = pessoas.map(p => ({
      pessoaId: p.pessoaId,
      nome: p.nome,
      modelo: p.modelo,
      linhas: [] as unknown[],
    }))

    if (!preenchida) {
      return NextResponse.json({ semana, marmoraria: { nome: marmoraria?.nome ?? 'MarmoApp' }, pessoas: base })
    }

    // ── Linhas já digitadas da semana, por pessoa ──────────────────
    const cadastroParaPessoa = new Map<string, string>()
    for (const p of pessoas) for (const c of p.cadastros) cadastroParaPessoa.set(c.id, p.pessoaId)

    const cadastroIds = [...cadastroParaPessoa.keys()]
    if (cadastroIds.length === 0) {
      return NextResponse.json({ semana, marmoraria: { nome: marmoraria?.nome ?? 'MarmoApp' }, pessoas: base })
    }

    const { data: linhas, error } = await supabase
      .from('producao_apontamentos')
      .select('etapa, data, quantidade, tipo_acabamento, peca_descricao, medida_comprimento, medida_largura, funcionario_id, orcamento_id, orcamento_item_id, obra_nome_avulso, is_retroativo')
      .eq('marmoraria_id', marmoraria_id)
      .in('funcionario_id', cadastroIds)
      .neq('status', 'rejeitado')
      .gte('data', semana)
      .lt('data', fimExclusivoDaSemana(semana))
      .order('data')
      .order('created_at')
    if (error) throw error

    const orcIds = [...new Set((linhas ?? []).map(l => l.orcamento_id).filter((v): v is string => !!v))]
    const itemIds = [...new Set((linhas ?? []).map(l => l.orcamento_item_id).filter((v): v is string => !!v))]

    const [orcRes, itemRes] = await Promise.all([
      orcIds.length
        ? supabase.from('orcamentos').select('id, numero, cliente_id').in('id', orcIds)
        : Promise.resolve({ data: [] as { id: string; numero: number | null; cliente_id: string | null }[] }),
      itemIds.length
        ? supabase.from('orcamento_itens').select('id, descricao').in('id', itemIds)
        : Promise.resolve({ data: [] as { id: string; descricao: string }[] }),
    ])
    const orcById = new Map((orcRes.data ?? []).map(o => [o.id, o]))
    const itemById = new Map((itemRes.data ?? []).map(i => [i.id, i.descricao]))

    const clienteIds = [...new Set((orcRes.data ?? []).map(o => o.cliente_id).filter((v): v is string => !!v))]
    let nomePorCliente = new Map<string, string>()
    if (clienteIds.length) {
      const { data: cls } = await supabase.from('clientes').select('id, nome').in('id', clienteIds)
      nomePorCliente = new Map((cls ?? []).map(c => [c.id, c.nome]))
    }

    const porPessoa = new Map(base.map(p => [p.pessoaId, p]))
    for (const l of linhas ?? []) {
      const pessoaId = l.funcionario_id ? cadastroParaPessoa.get(l.funcionario_id) : null
      const destino = pessoaId ? porPessoa.get(pessoaId) : null
      if (!destino) continue

      const orc = l.orcamento_id ? orcById.get(l.orcamento_id) : null
      destino.linhas.push({
        data: l.data,
        cliente: l.is_retroativo
          ? (l.obra_nome_avulso ?? '—')
          : (orc?.cliente_id ? nomePorCliente.get(orc.cliente_id) ?? `Orç. #${orc.numero ?? ''}` : `Orç. #${orc?.numero ?? ''}`),
        peca: (l.orcamento_item_id ? itemById.get(l.orcamento_item_id) : null) ?? l.peca_descricao ?? '—',
        quantidade: Number(l.quantidade ?? 0),
        tipo: l.etapa === 'instalacao' ? 'INST' : l.tipo_acabamento === 'meia_esquadria' ? 'ME' : l.etapa === 'acabamento' ? 'R' : '',
        comprimento: l.medida_comprimento != null ? Number(l.medida_comprimento) : null,
        largura: l.medida_largura != null ? Number(l.medida_largura) : null,
      })
    }

    return NextResponse.json({ semana, marmoraria: { nome: marmoraria?.nome ?? 'MarmoApp' }, pessoas: base })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha/pdf] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { ehSemanaCorrente, segundaDaSemana } from '@/lib/producao/semana'
import type { EtapaProducao } from '@/lib/producao/pessoas'
import { valorMetroInstalacao } from '@/lib/producao/ficha-server'
import { avancarSeEtapaCompleta, desmarcarPeca } from '@/lib/producao/registrar-etapa'

// Edição e exclusão de uma linha já lançada na ficha.
//
// Regra de trava (spec): instalação só mexe enquanto está `pendente` (já
// aprovada no fechamento de sexta, virou pagamento e fica travada);
// corte/acabamento só dentro da semana corrente — semana passada já virou
// histórico e alimenta os indicadores.

interface LinhaAtual {
  id: string
  etapa: EtapaProducao
  data: string
  status: string
  quantidade: number
  orcamento_id: string | null
  orcamento_item_id: string | null
  funcionario_id: string | null
  is_retroativo: boolean
  tipo_acabamento: string | null
}

async function carregarLinha(marmoraria_id: string, id: string): Promise<LinhaAtual | null> {
  const { data, error } = await supabase
    .from('producao_apontamentos')
    .select('id, etapa, data, status, quantidade, orcamento_id, orcamento_item_id, funcionario_id, is_retroativo, tipo_acabamento')
    .eq('id', id)
    .eq('marmoraria_id', marmoraria_id)
    .maybeSingle()
  if (error) throw error
  return (data as LinhaAtual | null) ?? null
}

function motivoTravada(linha: LinhaAtual): string | null {
  if (linha.etapa === 'instalacao') {
    if (linha.status !== 'pendente') {
      return 'Instalação já aprovada no fechamento — não pode mais ser alterada'
    }
    return null
  }
  if (!ehSemanaCorrente(segundaDaSemana(linha.data))) {
    return 'Linha de semana anterior — corte e acabamento só são editáveis na semana corrente'
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const linha = await carregarLinha(marmoraria_id, id)
    if (!linha) return NextResponse.json({ error: 'Linha não encontrada' }, { status: 404 })

    const travada = motivoTravada(linha)
    if (travada) return NextResponse.json({ error: travada }, { status: 409 })

    const body = await req.json()
    const patch: Record<string, unknown> = {}

    if (body.data !== undefined) {
      const novaData = String(body.data)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
        return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
      }
      // Só dá pra mover a linha entre dias da MESMA semana — mudar de
      // semana faria a linha sair de uma ficha e entrar em outra (que pode
      // estar fechada), e não é o que "corrigir o dia" quer dizer.
      if (segundaDaSemana(novaData) !== segundaDaSemana(linha.data)) {
        return NextResponse.json({ error: 'Só é possível mover a linha entre dias da mesma semana' }, { status: 400 })
      }
      patch.data = novaData
    }

    if (body.quantidade !== undefined) {
      const q = Number(body.quantidade)
      if (!Number.isFinite(q) || q <= 0) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
      patch.quantidade = q
    }

    if (body.tipo_acabamento !== undefined && linha.etapa === 'acabamento') {
      patch.tipo_acabamento = body.tipo_acabamento === 'meia_esquadria' ? 'meia_esquadria' : 'reto'
    }

    if (body.peca_descricao !== undefined && linha.is_retroativo) {
      const peca = String(body.peca_descricao).trim()
      if (!peca) return NextResponse.json({ error: 'Nome da peça obrigatório na obra avulsa' }, { status: 400 })
      patch.peca_descricao = peca
    }

    if (body.cliente_nome !== undefined && linha.is_retroativo) {
      const cliente = String(body.cliente_nome).trim()
      if (!cliente) return NextResponse.json({ error: 'Nome do cliente obrigatório na obra avulsa' }, { status: 400 })
      patch.obra_nome_avulso = cliente
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })
    }

    // Instalação: o valor acompanha o metro corrigido, recalculado no
    // servidor com o valor por metro do próprio apontamento (snapshot) —
    // não re-busca o cadastro, que pode ter mudado desde o lançamento.
    if (linha.etapa === 'instalacao' && patch.quantidade !== undefined) {
      const { data: atual } = await supabase
        .from('producao_apontamentos')
        .select('valor_metro_linear_aplicado, orcamento_item_id, funcionario_id')
        .eq('id', id)
        .single()

      let valorMetro = Number(atual?.valor_metro_linear_aplicado ?? 0)
      if (!(valorMetro > 0) && atual?.funcionario_id) {
        // Apontamento antigo sem snapshot de valor — cai no cadastro.
        let tipo_peca: string | null = null
        if (atual.orcamento_item_id) {
          const { data: item } = await supabase
            .from('orcamento_itens').select('tipo_peca').eq('id', atual.orcamento_item_id).maybeSingle()
          tipo_peca = item?.tipo_peca ?? null
        }
        valorMetro = (await valorMetroInstalacao(marmoraria_id, atual.funcionario_id, tipo_peca)) ?? 0
        if (!(valorMetro > 0)) {
          return NextResponse.json({ error: 'Instalador sem valor por metro cadastrado' }, { status: 400 })
        }
        patch.valor_metro_linear_aplicado = valorMetro
      }
      patch.valor_calculado = Number(patch.quantidade) * valorMetro
    }

    const { data, error } = await supabase
      .from('producao_apontamentos')
      .update(patch)
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('id, data, quantidade, valor_calculado, tipo_acabamento')
      .single()
    if (error) throw error

    // Se a data mudou, a peça em orcamento_itens segue a linha.
    if (patch.data && linha.orcamento_item_id) {
      const campo = linha.etapa === 'corte' ? 'cortado_em' : linha.etapa === 'acabamento' ? 'acabado_em' : 'instalado_em'
      await supabase
        .from('orcamento_itens')
        .update({ [campo]: `${patch.data as string}T12:00:00` })
        .eq('id', linha.orcamento_item_id)
        .eq('marmoraria_id', marmoraria_id)
    }

    return NextResponse.json({ ok: true, linha: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha PATCH] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const linha = await carregarLinha(marmoraria_id, id)
    if (!linha) return NextResponse.json({ error: 'Linha não encontrada' }, { status: 404 })

    const travada = motivoTravada(linha)
    if (travada) return NextResponse.json({ error: travada }, { status: 409 })

    const { error } = await supabase
      .from('producao_apontamentos')
      .delete()
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
    if (error) throw error

    // Peça volta a pendente na Fila — e o pedido volta a precisar dela pra
    // avançar de etapa. Não retrocede o `producao_status` (decisão do
    // gestor na Fila), só devolve a peça pra lista de pendentes.
    if (linha.orcamento_item_id) {
      await desmarcarPeca(marmoraria_id, linha.orcamento_item_id, linha.etapa)
      if (linha.orcamento_id) {
        await avancarSeEtapaCompleta(marmoraria_id, linha.orcamento_id, linha.etapa)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha DELETE] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

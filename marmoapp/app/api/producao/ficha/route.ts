import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { fimExclusivoDaSemana } from '@/lib/producao/semana'
import type { EtapaProducao } from '@/lib/producao/pessoas'
import {
  buscarPessoa, garantirFicha, validarSemana, valorMetroInstalacao, statusDaEtapa,
} from '@/lib/producao/ficha-server'
import {
  SELECT_ITENS_PRODUCAO, apontamentoDaPeca, avancarSeEtapaCompleta, registrarPeca,
  type ItemProducao,
} from '@/lib/producao/registrar-etapa'
import { quantidadeSistema, unidadeDaEtapa } from '@/lib/producao/quantidade-sistema'

// Lançamento da ficha semanal de produção (digitação do papel).
//
// GET  ?pessoa=&semana=  → linhas já lançadas da semana + estado da ficha
// POST                   → cria uma linha (obra cadastrada ou avulsa)
//
// Regra que vale pra tudo aqui: a data do apontamento é a do BLOCO DO DIA
// na ficha, nunca a data da digitação. As fichas de 07/10 em diante são
// lançadas retroativamente com a data certa.

const ETAPAS_VALIDAS: EtapaProducao[] = ['corte', 'acabamento', 'instalacao']

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const pessoaId = req.nextUrl.searchParams.get('pessoa')
    const semanaParam = validarSemana(req.nextUrl.searchParams.get('semana'))
    if (!semanaParam.ok) return NextResponse.json({ error: semanaParam.erro }, { status: 400 })
    if (!pessoaId) return NextResponse.json({ error: 'Parâmetro pessoa obrigatório' }, { status: 400 })
    const semana = semanaParam.semana

    const pessoa = await buscarPessoa(marmoraria_id, pessoaId)
    if (!pessoa) return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })

    const ficha = await garantirFicha(marmoraria_id, pessoaId, semana)

    const { data: marmorariaRow } = await supabase
      .from('marmorarias').select('fator_meia_esquadria').eq('id', marmoraria_id).maybeSingle()

    // Todos os cadastros da pessoa (o de acabador e o de instalador
    // gravam funcionario_id diferente, mas estão na mesma ficha).
    const cadastroIds = pessoa.cadastros.map(c => c.id)

    const { data: linhas, error } = await supabase
      .from('producao_apontamentos')
      .select('id, etapa, data, quantidade, quantidade_sistema, unidade, tipo_acabamento, peca_descricao, medida_comprimento, medida_largura, status, origem, funcionario_id, orcamento_id, orcamento_item_id, obra_nome_avulso, valor_calculado, valor_metro_linear_aplicado, is_retroativo')
      .eq('marmoraria_id', marmoraria_id)
      .in('funcionario_id', cadastroIds)
      .neq('status', 'rejeitado')
      .gte('data', semana)
      .lt('data', fimExclusivoDaSemana(semana))
      .order('data')
      .order('created_at')
    if (error) throw error

    // Nome do cliente/pedido de cada linha de obra cadastrada.
    const orcIds = [...new Set((linhas ?? []).map(l => l.orcamento_id).filter((v): v is string => !!v))]
    let orcamentos: { id: string; numero: number | null; titulo: string | null; cliente_id: string | null }[] = []
    let clientes: { id: string; nome: string }[] = []
    if (orcIds.length) {
      const { data: orcs } = await supabase
        .from('orcamentos')
        .select('id, numero, titulo, cliente_id')
        .eq('marmoraria_id', marmoraria_id)
        .in('id', orcIds)
      orcamentos = orcs ?? []
      const clienteIds = [...new Set(orcamentos.map(o => o.cliente_id).filter((v): v is string => !!v))]
      if (clienteIds.length) {
        const { data: cls } = await supabase.from('clientes').select('id, nome').in('id', clienteIds)
        clientes = cls ?? []
      }
    }
    const orcById = new Map(orcamentos.map(o => [o.id, o]))
    const clienteById = new Map(clientes.map(c => [c.id, c.nome]))

    const resultado = (linhas ?? []).map(l => {
      const orc = l.orcamento_id ? orcById.get(l.orcamento_id) : null
      return {
        ...l,
        cliente_nome: l.is_retroativo
          ? l.obra_nome_avulso
          : (orc?.cliente_id ? clienteById.get(orc.cliente_id) ?? null : null),
        pedido_label: orc ? (orc.titulo || `Orç. #${orc.numero ?? ''}`.trim()) : null,
        pedido_numero: orc?.numero ?? null,
        // Instalação já aprovada no fechamento fica travada; corte e
        // acabamento só editam enquanto a ficha da semana está aberta.
        editavel: l.etapa === 'instalacao'
          ? l.status === 'pendente'
          : ficha.status === 'aberta',
      }
    })

    return NextResponse.json({
      ficha,
      fator_meia_esquadria: Number(marmorariaRow?.fator_meia_esquadria ?? 1) || 1,
      pessoa: {
        pessoaId: pessoa.pessoaId,
        nome: pessoa.nome,
        modelo: pessoa.modelo,
        etapas: ETAPAS_VALIDAS.filter(e => !!pessoa.cadastroPorEtapa[e]),
      },
      linhas: resultado,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha GET] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const pessoaId = String(body.pessoa_id ?? '')
    const etapa = String(body.etapa ?? '') as EtapaProducao
    const data = String(body.data ?? '')
    const quantidadeFicha = Number(body.quantidade)

    if (!pessoaId) return NextResponse.json({ error: 'Pessoa obrigatória' }, { status: 400 })
    if (!ETAPAS_VALIDAS.includes(etapa)) return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Data do dia inválida' }, { status: 400 })

    const pessoa = await buscarPessoa(marmoraria_id, pessoaId)
    if (!pessoa) return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })

    // O funcionario_id gravado é o cadastro correspondente à etapa —
    // instalação usa o cadastro de instalador (é ele que tem o valor por
    // metro); corte e acabamento usam o cadastro interno.
    const cadastro = pessoa.cadastroPorEtapa[etapa]
    if (!cadastro) {
      return NextResponse.json(
        { error: `${pessoa.nome} não tem cadastro de ${etapa === 'instalacao' ? 'instalador' : etapa === 'corte' ? 'serrador' : 'acabador'} — lançamento de ${etapa} não permitido` },
        { status: 400 }
      )
    }

    const semanaDaLinha = validarSemana(String(body.semana ?? ''))
    if (!semanaDaLinha.ok) return NextResponse.json({ error: semanaDaLinha.erro }, { status: 400 })
    const ficha = await garantirFicha(marmoraria_id, pessoaId, semanaDaLinha.semana)
    if (ficha.status === 'fechada') {
      return NextResponse.json({ error: 'Semana já fechada — reabra a ficha para lançar' }, { status: 409 })
    }

    const tipo_acabamento = etapa === 'acabamento'
      ? (body.tipo_acabamento === 'meia_esquadria' ? 'meia_esquadria' : 'reto')
      : null

    // ── Obra avulsa ───────────────────────────────────────────────
    if (body.avulso) {
      const cliente = String(body.cliente_nome ?? '').trim()
      const peca = String(body.peca_descricao ?? '').trim()
      if (!cliente) return NextResponse.json({ error: 'Nome do cliente obrigatório na obra avulsa' }, { status: 400 })
      if (!peca) return NextResponse.json({ error: 'Nome da peça obrigatório na obra avulsa' }, { status: 400 })

      const comprimento = body.medida_comprimento != null ? Number(body.medida_comprimento) : null
      const largura = body.medida_largura != null ? Number(body.medida_largura) : null

      // Corte avulso vem como C × L; as outras etapas vêm em ml direto.
      const quantidade = etapa === 'corte' && comprimento && largura
        ? comprimento * largura
        : quantidadeFicha

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return NextResponse.json(
          { error: etapa === 'corte' ? 'Informe comprimento e largura (ou os m² direto)' : 'Metros lineares inválidos' },
          { status: 400 }
        )
      }

      let valor_metro_linear_aplicado: number | null = null
      let valor_calculado: number | null = null
      if (etapa === 'instalacao') {
        // Avulso não tem tipo de peça — sempre o valor fixo do cadastro.
        valor_metro_linear_aplicado = await valorMetroInstalacao(marmoraria_id, cadastro.id, null)
        if (!valor_metro_linear_aplicado) {
          return NextResponse.json({ error: 'Instalador sem valor por metro cadastrado' }, { status: 400 })
        }
        valor_calculado = quantidade * valor_metro_linear_aplicado
      }

      const { data: row, error } = await supabase
        .from('producao_apontamentos')
        .insert({
          marmoraria_id,
          orcamento_id: null,
          orcamento_item_id: null,
          funcionario_id: cadastro.id,
          etapa,
          quantidade,
          quantidade_sistema: null,
          unidade: unidadeDaEtapa(etapa),
          data,
          origem: 'ficha',
          status: statusDaEtapa(etapa),
          tipo_acabamento,
          peca_descricao: peca,
          medida_comprimento: etapa === 'corte' ? comprimento : null,
          medida_largura: etapa === 'corte' ? largura : null,
          obra_nome_avulso: cliente,
          obra_local_avulso: null,
          valor_metro_linear_aplicado,
          valor_calculado,
          is_retroativo: true,
        })
        .select('id')
        .single()
      if (error) throw error

      return NextResponse.json({ ok: true, id: row.id, valor_calculado }, { status: 201 })
    }

    // ── Obra cadastrada ───────────────────────────────────────────
    const orcamento_item_id = String(body.orcamento_item_id ?? '')
    if (!orcamento_item_id) return NextResponse.json({ error: 'Selecione a peça do pedido' }, { status: 400 })

    const { data: itemRow, error: itemErr } = await supabase
      .from('orcamento_itens')
      .select(SELECT_ITENS_PRODUCAO)
      .eq('id', orcamento_item_id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()
    if (itemErr) throw itemErr
    if (!itemRow) return NextResponse.json({ error: 'Peça não encontrada' }, { status: 404 })
    const item = itemRow as unknown as ItemProducao

    const quantidade = quantidadeFicha
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return NextResponse.json(
        { error: etapa === 'corte' ? 'Quantidade em m² inválida' : 'Metros lineares inválidos' },
        { status: 400 }
      )
    }

    let valor_metro_linear_aplicado: number | null = null
    let valor_calculado: number | null = null
    if (etapa === 'instalacao') {
      valor_metro_linear_aplicado = await valorMetroInstalacao(marmoraria_id, cadastro.id, item.tipo_peca ?? null)
      if (!valor_metro_linear_aplicado) {
        return NextResponse.json({ error: 'Instalador sem valor por metro cadastrado' }, { status: 400 })
      }
      // Valor SEMPRE calculado no servidor — o cliente nunca manda o total.
      valor_calculado = quantidade * valor_metro_linear_aplicado
    }

    const anterior = await apontamentoDaPeca(marmoraria_id, orcamento_item_id, etapa)

    const { id, criado } = await registrarPeca({
      marmoraria_id,
      orcamento_id: item.orcamento_id,
      item,
      etapa,
      funcionario_id: cadastro.id,
      data,
      quantidade,
      origem: 'ficha',
      status: statusDaEtapa(etapa),
      tipo_acabamento,
      valor_metro_linear_aplicado,
      valor_calculado,
    })

    const avanco = await avancarSeEtapaCompleta(marmoraria_id, item.orcamento_id, etapa)

    return NextResponse.json({
      ok: true,
      id,
      criado,
      // A tela avisa "já registrada em DD/MM" quando o segundo caminho
      // (ficha depois da Fila, ou vice-versa) atualizou em vez de criar.
      substituiu: criado ? null : { data: anterior?.data ?? null, quantidade: anterior?.quantidade ?? null },
      valor_calculado,
      quantidade_sistema: quantidadeSistema(item, etapa),
      avanco,
    }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    console.error('[producao/ficha POST] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

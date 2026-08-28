import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

// Obras atribuídas a um instalador = eventos de agenda do tipo
// "Entrega/Instalação" com esse funcionario_id (é o mecanismo de
// atribuição que já existe hoje, via AgendaPage/NovoEventoModal — não
// criamos uma tabela de atribuição nova).
//
// Só devolve dados técnicos + contato do cliente. NUNCA inclui
// preco_unitario, custo_m2, markup, total_item, custo_item nem qualquer
// campo de valor/margem do orçamento — regra de negócio do portal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ funcionarioId: string }> }) {
  try {
    const { funcionarioId } = await params
    const marmoraria_id = getPortalMarmorariaId()

    const { data: funcionario, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', funcionarioId)
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', 'instalador')
      .eq('ativo', true)
      .maybeSingle()
    if (funcErr) throw funcErr
    if (!funcionario) return NextResponse.json({ error: 'Instalador não encontrado' }, { status: 404 })

    const { data: eventos, error: eventosErr } = await supabase
      .from('agenda_events')
      .select('id, titulo, descricao, data_inicio, status, cliente_id, orcamento_id, agenda_event_types!inner(nome)')
      .eq('marmoraria_id', marmoraria_id)
      .eq('funcionario_id', funcionarioId)
      .eq('agenda_event_types.nome', 'Entrega/Instalação')
      .neq('status', 'cancelado')
      .order('data_inicio', { ascending: true })
    if (eventosErr) throw eventosErr

    interface ClienteRow { id: string; nome: string; telefone: string | null; whatsapp: string | null; endereco: string | null; cidade: string | null; estado: string | null }
    interface OrcamentoRow { id: string; numero_os: string | null; observacoes: string | null; data_prevista_instalacao: string | null }
    interface ItemRow {
      id: string; orcamento_id: string; descricao: string; tipo_peca: string | null; ambiente: string | null
      largura: number | null; altura: number | null; area: number | null; quantidade: number
      desenho_tipo: string | null; desenho_params: Record<string, unknown> | null
      instalado_em: string | null; instalado_por: string | null; material_id: string | null
    }

    const clienteIds = [...new Set((eventos ?? []).map(e => e.cliente_id).filter((v): v is string => !!v))]
    const orcamentoIds = [...new Set((eventos ?? []).map(e => e.orcamento_id).filter((v): v is string => !!v))]

    let clientes: ClienteRow[] = []
    let orcamentos: OrcamentoRow[] = []
    let itens: ItemRow[] = []

    if (clienteIds.length) {
      const { data } = await supabase.from('clientes').select('id, nome, telefone, whatsapp, endereco, cidade, estado').in('id', clienteIds)
      clientes = data ?? []
    }
    if (orcamentoIds.length) {
      const [{ data: orcData }, { data: itensData }] = await Promise.all([
        supabase.from('orcamentos').select('id, numero_os, observacoes, data_prevista_instalacao').in('id', orcamentoIds),
        supabase.from('orcamento_itens')
          .select('id, orcamento_id, descricao, tipo_peca, ambiente, largura, altura, area, quantidade, desenho_tipo, desenho_params, instalado_em, instalado_por, material_id')
          .in('orcamento_id', orcamentoIds),
      ])
      orcamentos = orcData ?? []
      itens = itensData ?? []
    }

    const materialIds = [...new Set(itens.map(i => i.material_id).filter((v): v is string => !!v))]
    let materiais: { id: string; nome: string }[] = []
    if (materialIds.length) {
      const { data } = await supabase.from('materiais').select('id, nome').in('id', materialIds)
      materiais = data ?? []
    }

    const clientesById = new Map(clientes.map(c => [c.id, c]))
    const orcamentosById = new Map(orcamentos.map(o => [o.id, o]))
    const materiaisById = new Map(materiais.map(m => [m.id, m.nome]))
    const itensPorOrcamento = new Map<string, ItemRow[]>()
    for (const item of itens) {
      const lista = itensPorOrcamento.get(item.orcamento_id) ?? []
      lista.push(item)
      itensPorOrcamento.set(item.orcamento_id, lista)
    }

    const obras = (eventos ?? []).map(e => {
      const orcamento = e.orcamento_id ? orcamentosById.get(e.orcamento_id) : null
      const itensDoOrcamento = e.orcamento_id ? (itensPorOrcamento.get(e.orcamento_id) ?? []) : []
      return {
        id: e.id,
        titulo: e.titulo,
        descricao: e.descricao,
        data_inicio: e.data_inicio,
        status: e.status,
        cliente: e.cliente_id ? clientesById.get(e.cliente_id) ?? null : null,
        orcamento: orcamento ? {
          id: orcamento.id,
          numero_os: orcamento.numero_os,
          observacoes: orcamento.observacoes,
          data_prevista_instalacao: orcamento.data_prevista_instalacao,
          itens: itensDoOrcamento.map(i => ({
            id: i.id,
            descricao: i.descricao,
            tipo_peca: i.tipo_peca,
            ambiente: i.ambiente,
            largura: i.largura,
            altura: i.altura,
            area: i.area,
            quantidade: i.quantidade,
            material_nome: i.material_id ? materiaisById.get(i.material_id) ?? null : null,
            desenho_tipo: i.desenho_tipo,
            desenho_params: i.desenho_params,
            instalado: !!i.instalado_em,
          })),
        } : null,
      }
    })

    return NextResponse.json(obras)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

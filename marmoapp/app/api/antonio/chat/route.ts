import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent, type AgentMessage } from '@/lib/antonio/agent'
import type { Catalogo } from '@/lib/antonio/knowledge-base'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, marmoraria, catalogo } = body as {
      messages: AgentMessage[]
      marmoraria: { id: string; nome: string }
      catalogo: Catalogo['materiais'] extends infer M ? {
        materiais?: M
        servicos?: Catalogo['servicos']
        clientes?: Catalogo['clientes']
      } : never
    }

    if (!messages || !marmoraria) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const result = await runAgent(messages, {
      marmoraria,
      materiais: (catalogo as { materiais?: Catalogo['materiais'] })?.materiais,
      servicos: (catalogo as { servicos?: Catalogo['servicos'] })?.servicos,
      clientes: (catalogo as { clientes?: Catalogo['clientes'] })?.clientes,
    })

    let orcamentoId: string | null = null

    if (result.orcamento) {
      const { itens, mao_obra, total, descricao, cliente_nome, observacoes } = result.orcamento

      const clienteMatch = cliente_nome
        ? ((catalogo as { clientes?: Array<{ nome: string; id: string }> })?.clientes || []).find(
            c => c.nome.toLowerCase().includes(cliente_nome.toLowerCase())
          )
        : null

      const { data: orc, error: orcErr } = await supabase
        .from('orcamentos')
        .insert({
          marmoraria_id: marmoraria.id,
          cliente_id: clienteMatch?.id || null,
          descricao,
          status: 'rascunho',
          mao_obra,
          desconto_rs: 0,
          total,
          observacoes: observacoes || null,
          crm_status: 'novo',
          producao_status: 'comercial',
        })
        .select()
        .single()

      if (!orcErr && orc && itens.length > 0) {
        await supabase.from('orcamento_itens').insert(
          itens.map(i => ({
            orcamento_id: orc.id,
            tipo: i.tipo,
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
            total_item: i.quantidade * i.preco_unitario,
          }))
        )

        // Log no antonio_quotes
        await supabase.from('antonio_quotes').insert({
          orcamento_id: orc.id,
          marmoraria_id: marmoraria.id,
          input_text: messages[messages.length - 1]?.content || null,
          raw_json: result.orcamento as unknown as Record<string, unknown>,
          status: 'criado',
        })

        orcamentoId = orc.id
      }
    }

    const finalMessage = orcamentoId
      ? `${result.displayText}\n\n✅ Orçamento criado como rascunho! Acesse a aba Orçamentos para revisar e enviar.`
      : result.displayText

    return NextResponse.json({ message: finalMessage, orcamentoId })
  } catch (e: unknown) {
    console.error('[antonio/chat] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

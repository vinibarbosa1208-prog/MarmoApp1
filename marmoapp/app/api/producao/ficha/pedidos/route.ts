import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Busca de cliente/pedido pra linha de obra cadastrada: orçamentos
// aprovados com `producao_status` diferente de `finalizado`, por nome do
// cliente ou número do pedido. É o primeiro campo da linha na tela.

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()

    const { data: orcs, error } = await supabase
      .from('orcamentos')
      .select('id, numero, titulo, cliente_id, producao_status, data_fechamento')
      .eq('marmoraria_id', marmoraria_id)
      .eq('status', 'aprovado')
      .or('producao_status.is.null,producao_status.neq.finalizado')
      .order('numero', { ascending: false })
      .limit(400)
    if (error) throw error

    const clienteIds = [...new Set((orcs ?? []).map(o => o.cliente_id).filter((v): v is string => !!v))]
    let nomePorCliente = new Map<string, string>()
    if (clienteIds.length) {
      const { data: cls } = await supabase.from('clientes').select('id, nome').in('id', clienteIds)
      nomePorCliente = new Map((cls ?? []).map(c => [c.id, c.nome]))
    }

    const termo = q.toLowerCase()
    const pedidos = (orcs ?? [])
      .map(o => ({
        id: o.id,
        numero: o.numero,
        titulo: o.titulo,
        producao_status: o.producao_status,
        cliente_nome: o.cliente_id ? nomePorCliente.get(o.cliente_id) ?? null : null,
      }))
      .filter(p => {
        if (!termo) return true
        return (p.cliente_nome ?? '').toLowerCase().includes(termo)
          || String(p.numero ?? '').includes(termo)
          || (p.titulo ?? '').toLowerCase().includes(termo)
      })
      .slice(0, 50)

    return NextResponse.json({ pedidos })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha/pedidos] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

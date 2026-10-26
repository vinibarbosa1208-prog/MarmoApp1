import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { errMsg } from '@/lib/minha-pia/servidor'
import { soDigitos } from '@/lib/minha-pia/regras'

// PUT — configurações do programa + preço/custo dos kits.
export async function PUT(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const b = await req.json().catch(() => ({}))

    const prazo = Number(b.prazo_entrega_dias)
    if (!(prazo >= 1 && prazo <= 180)) return NextResponse.json({ error: 'Prazo de entrega inválido' }, { status: 400 })
    const cidades = Array.isArray(b.cidades_atendidas) ? b.cidades_atendidas.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 60) : []
    const parcelas = Array.isArray(b.parcelas_opcoes) ? b.parcelas_opcoes.map(Number).filter((n: number) => n >= 50 && n <= 5000) : []
    if (!parcelas.length) return NextResponse.json({ error: 'Informe ao menos um valor de parcela' }, { status: 400 })

    const { error } = await supabase.from('programado_config').upsert({
      marmoraria_id,
      ativo: !!b.ativo,
      prazo_entrega_dias: prazo,
      cidades_atendidas: cidades,
      parcelas_opcoes: parcelas,
      whatsapp_contato: soDigitos(b.whatsapp_contato) || null,
      pix_chave: typeof b.pix_chave === 'string' ? b.pix_chave.trim().slice(0, 140) || null : null,
      pix_favorecido: typeof b.pix_favorecido === 'string' ? b.pix_favorecido.trim().slice(0, 120) || null : null,
    })
    if (error) throw error

    if (Array.isArray(b.kits)) {
      for (const k of b.kits as { id: string; preco_total: number; custo_base: number; ativo: boolean }[]) {
        const preco = Number(k.preco_total), custo = Number(k.custo_base)
        if (!(preco > 0) || !(custo >= 0)) continue
        await supabase.from('programado_kits').update({ preco_total: preco, custo_base: custo, ativo: !!k.ativo })
          .eq('id', k.id).eq('marmoraria_id', marmoraria_id)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

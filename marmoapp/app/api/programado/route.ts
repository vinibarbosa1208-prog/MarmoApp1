import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { CAMPOS_ADESAO_SEGUROS } from '@/lib/minha-pia/cobranca'
import { carregarConfig, errMsg } from '@/lib/minha-pia/servidor'
import { asaasConfigurado } from '@/lib/minha-pia/asaas'

// GET — visão do gestor: adesões, kits, config e lista de espera.
export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [{ data: adesoes, error }, { data: kits }, config, { data: espera }] = await Promise.all([
      supabase.from('programado_adesoes').select(CAMPOS_ADESAO_SEGUROS).eq('marmoraria_id', marmoraria_id).order('created_at', { ascending: false }),
      supabase.from('programado_kits').select('id, codigo, nome, grupo, material_nome, tom, preco_total, custo_base, ativo, ordem').eq('marmoraria_id', marmoraria_id).order('ordem'),
      carregarConfig(marmoraria_id),
      supabase.from('programado_lista_espera').select('id, nome, whatsapp, cidade, kit_codigo, created_at').eq('marmoraria_id', marmoraria_id).order('created_at', { ascending: false }).limit(300),
    ])
    if (error) throw error
    return NextResponse.json({ adesoes: adesoes ?? [], kits: kits ?? [], config, lista_espera: espera ?? [], asaas: asaasConfigurado() })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

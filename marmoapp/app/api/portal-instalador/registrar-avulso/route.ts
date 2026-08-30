import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

// Registro de serviço avulso — obra que nunca vai ter orçamento no
// MarmoApp (obra antiga, ou cliente atendido fora do sistema). Mesmo
// padrão de segurança de registrar-item: sem sessão, service role,
// validado por parâmetro. Sem orcamento_id/orcamento_item_id — por isso
// não há "obra concluída" pra fechar aqui.
export async function POST(req: NextRequest) {
  let fotoPath: string | null = null
  try {
    const marmoraria_id = getPortalMarmorariaId()
    const form = await req.formData()

    const funcionario_id = String(form.get('funcionario_id') ?? '')
    const obra_nome_avulso = String(form.get('obra_nome_avulso') ?? '').trim()
    const obra_local_avulso = String(form.get('obra_local_avulso') ?? '').trim()
    const metros_lineares = Number(form.get('metros_lineares'))
    const valor_metro_linear_aplicado = Number(form.get('valor_metro_linear_aplicado'))
    const foto = form.get('foto')

    if (!funcionario_id || !obra_nome_avulso || !obra_local_avulso) {
      return NextResponse.json({ error: 'Nome do cliente e local da obra são obrigatórios' }, { status: 400 })
    }
    if (!Number.isFinite(metros_lineares) || metros_lineares <= 0) {
      return NextResponse.json({ error: 'Metro linear inválido' }, { status: 400 })
    }
    if (!Number.isFinite(valor_metro_linear_aplicado) || valor_metro_linear_aplicado <= 0) {
      return NextResponse.json({ error: 'Valor por metro inválido' }, { status: 400 })
    }
    if (!(foto instanceof File) || foto.size === 0) {
      return NextResponse.json({ error: 'Foto obrigatória' }, { status: 400 })
    }

    const { data: funcionario, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', funcionario_id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('cargo', 'instalador')
      .eq('ativo', true)
      .maybeSingle()
    if (funcErr) throw funcErr
    if (!funcionario) return NextResponse.json({ error: 'Instalador não encontrado' }, { status: 404 })

    const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    fotoPath = `${marmoraria_id}/${funcionario_id}/avulso-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('comprovantes-instalacao')
      .upload(fotoPath, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type || 'image/jpeg' })
    if (uploadErr) throw uploadErr

    const valor_calculado = metros_lineares * valor_metro_linear_aplicado
    const hoje = new Date().toISOString().split('T')[0]

    const { error: apontErr } = await supabase.from('producao_apontamentos').insert({
      marmoraria_id,
      orcamento_id: null,
      orcamento_item_id: null,
      funcionario_id,
      etapa: 'instalacao',
      quantidade: metros_lineares,
      unidade: 'ml',
      data: hoje,
      origem: 'manual',
      status: 'pendente',
      foto_storage_path: fotoPath,
      valor_calculado,
      valor_metro_linear_aplicado,
      obra_nome_avulso,
      obra_local_avulso,
      is_retroativo: true,
    })
    if (apontErr) throw apontErr

    return NextResponse.json({ ok: true, valor_calculado })
  } catch (e: unknown) {
    if (fotoPath) await supabase.storage.from('comprovantes-instalacao').remove([fotoPath]).catch(() => {})
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    console.error('[registrar-avulso] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getPortalMarmorariaId } from '@/lib/portal-instalador-config'

interface ItemInstalacaoRow { id: string; area: number | null; instalado_em: string | null }

// Mesma regra de "peça física" já usada na fila (corte): tem área > 0.
// Itens de serviço/frete não entram na conta de "obra concluída".
function itensRelevantesInstalacao(itens: ItemInstalacaoRow[]): ItemInstalacaoRow[] {
  return itens.filter(i => (i.area || 0) > 0)
}

// Registra um item instalado: metro linear + foto obrigatória. Calcula o
// valor na hora (snapshot, não recalcula depois se o cadastro mudar) e,
// se essa era a última peça pendente da obra, marca o evento da agenda
// como concluído automaticamente. Sem sessão de propósito (item 5b) --
// tudo validado por parâmetro + regra de negócio no servidor.
export async function POST(req: NextRequest) {
  let fotoPath: string | null = null
  try {
    const marmoraria_id = getPortalMarmorariaId()
    const form = await req.formData()

    const funcionario_id = String(form.get('funcionario_id') ?? '')
    const agenda_event_id = String(form.get('agenda_event_id') ?? '')
    const orcamento_item_id = String(form.get('orcamento_item_id') ?? '')
    const metros_lineares = Number(form.get('metros_lineares'))
    // Valor por metro sugerido pro instalador nessa peça específica — decisão
    // de 29/08: peças menores (pingadeira, soleira etc.) valem menos que o
    // padrão do cadastro, então não é mais sempre funcionarios.valor_metro_linear.
    // O gestor ainda pode ajustar no fechamento semanal antes de aprovar.
    const valor_metro_linear_aplicado = Number(form.get('valor_metro_linear_aplicado'))
    const foto = form.get('foto')

    if (!funcionario_id || !agenda_event_id || !orcamento_item_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
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

    const { data: evento, error: eventoErr } = await supabase
      .from('agenda_events')
      .select('id, orcamento_id, status')
      .eq('id', agenda_event_id)
      .eq('marmoraria_id', marmoraria_id)
      .eq('funcionario_id', funcionario_id)
      .maybeSingle()
    if (eventoErr) throw eventoErr
    if (!evento || !evento.orcamento_id) return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 })
    if (evento.status === 'cancelado') return NextResponse.json({ error: 'Essa obra foi cancelada' }, { status: 400 })

    const { data: item, error: itemErr } = await supabase
      .from('orcamento_itens')
      .select('id, orcamento_id')
      .eq('id', orcamento_item_id)
      .eq('orcamento_id', evento.orcamento_id)
      .maybeSingle()
    if (itemErr) throw itemErr
    if (!item) return NextResponse.json({ error: 'Peça não pertence a essa obra' }, { status: 400 })

    const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    fotoPath = `${marmoraria_id}/${funcionario_id}/${orcamento_item_id}-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('comprovantes-instalacao')
      .upload(fotoPath, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type || 'image/jpeg' })
    if (uploadErr) throw uploadErr

    const valor_calculado = metros_lineares * valor_metro_linear_aplicado
    const hoje = new Date().toISOString().split('T')[0]

    const { error: apontErr } = await supabase.from('producao_apontamentos').insert({
      marmoraria_id,
      orcamento_id: evento.orcamento_id,
      orcamento_item_id,
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
      is_retroativo: false,
    })
    if (apontErr) throw apontErr

    const { error: itemUpdErr } = await supabase
      .from('orcamento_itens')
      .update({ instalado_por: funcionario_id, instalado_em: new Date().toISOString() })
      .eq('id', orcamento_item_id)
    if (itemUpdErr) throw itemUpdErr

    // Confere se essa era a última peça pendente da obra
    const { data: todosItens, error: todosErr } = await supabase
      .from('orcamento_itens')
      .select('id, area, instalado_em')
      .eq('orcamento_id', evento.orcamento_id)
    if (todosErr) throw todosErr

    const relevantes = itensRelevantesInstalacao(todosItens ?? [])
    const obraConcluida = relevantes.length > 0 && relevantes.every(i => i.instalado_em)

    if (obraConcluida) {
      await supabase.from('agenda_events').update({ status: 'concluido' }).eq('id', agenda_event_id)
    }

    return NextResponse.json({ ok: true, valor_calculado, obra_concluida: obraConcluida })
  } catch (e: unknown) {
    // Se algo falhou depois do upload, remove a foto órfã.
    if (fotoPath) await supabase.storage.from('comprovantes-instalacao').remove([fotoPath]).catch(() => {})
    // Erros do Supabase (PostgrestError/StorageError) não são instâncias de
    // Error — pegar .message direto evita mascarar a causa real com "Erro interno".
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    console.error('[registrar-item] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

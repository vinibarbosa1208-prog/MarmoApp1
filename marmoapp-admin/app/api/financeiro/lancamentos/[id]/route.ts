import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { COLUNAS_LANCAMENTO } from '@/lib/financeiro-servidor'
import { data as lerData, lerLancamento, valor as lerValor } from '@/lib/financeiro-validacao'
import { hojeBR, somarDias, type Lancamento } from '@/lib/financeiro'

type Ctx = { params: Promise<{ id: string }> }

async function buscar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabaseAdmin.from('admin_fin_lancamentos').select(COLUNAS_LANCAMENTO).eq('id', id).maybeSingle()
  return (data as Lancamento | null) ?? null
}

// Editar um lançamento (ou uma recorrência inteira, daqui para a frente).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const atual = await buscar((await params).id)
  if (!atual) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const mud = lerLancamento({ tipo: atual.tipo, ...b }, false)
  if (typeof mud === 'string') return NextResponse.json({ error: mud }, { status: 400 })
  if (atual.origem_id) {
    delete mud.recorrencia
    delete mud.recorrencia_fim
  }

  const { data, error } = await supabaseAdmin
    .from('admin_fin_lancamentos')
    .update({ ...mud, updated_at: new Date().toISOString() })
    .eq('id', atual.id)
    .select(COLUNAS_LANCAMENTO)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lancamento: data })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const atual = await buscar((await params).id)
  if (!atual) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  const { error } = await supabaseAdmin.from('admin_fin_lancamentos').delete().eq('id', atual.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * Ações sobre uma data:
 *  realizar  { data, data_realizada?, valor? }  marca como recebido/pago
 *  pular     { data }                           esta data não vai acontecer
 *  desfazer  { data }                           volta para previsto
 *  encerrar  { data }                           recorrência termina nesta data (inclusive)
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const l = await buscar((await params).id)
  if (!l) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const acao = b.acao
  const data = lerData(b.data) ?? l.data_prevista
  const agora = new Date().toISOString()
  const tabela = supabaseAdmin.from('admin_fin_lancamentos')

  if (acao === 'encerrar') {
    if (l.recorrencia === 'unica') return NextResponse.json({ error: 'Só recorrências podem ser encerradas.' }, { status: 400 })
    const fim = data < l.data_prevista ? l.data_prevista : data
    const { error } = await tabela.update({ recorrencia_fim: fim, updated_at: agora }).eq('id', l.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // registros de datas depois do fim deixam de valer
    await tabela.delete().eq('origem_id', l.id).gt('data_prevista', fim)
    return NextResponse.json({ ok: true })
  }

  if (acao !== 'realizar' && acao !== 'pular' && acao !== 'desfazer')
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const realizadaEm = lerData(b.data_realizada) ?? hojeBR()
  const valor = lerValor(b.valor) ?? Number(l.valor)

  // Lançamento único: muda o próprio registro.
  if (l.recorrencia === 'unica') {
    const mud =
      acao === 'realizar'
        ? { status: 'realizado', data_realizada: realizadaEm, valor }
        : acao === 'pular'
          ? { status: 'cancelado', data_realizada: null }
          : { status: 'previsto', data_realizada: null }
    const { error } = await tabela.update({ ...mud, updated_at: agora }).eq('id', l.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Recorrência: confere se a data pertence à série.
  if (data < l.data_prevista || (l.recorrencia_fim && data > l.recorrencia_fim))
    return NextResponse.json({ error: 'Data fora da recorrência.' }, { status: 400 })
  if (l.recorrencia !== 'mensal') {
    const passo = l.recorrencia === 'semanal' ? 7 : 14
    const dias = Math.round((Date.parse(data) - Date.parse(l.data_prevista)) / 86400000)
    if (dias % passo !== 0) return NextResponse.json({ error: 'Data fora da recorrência.' }, { status: 400 })
  }

  await tabela.delete().eq('origem_id', l.id).eq('data_prevista', data)
  if (acao === 'desfazer') return NextResponse.json({ ok: true })

  const { error } = await tabela.insert({
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao,
    valor,
    data_prevista: data,
    recorrencia: 'unica',
    status: acao === 'realizar' ? 'realizado' : 'cancelado',
    data_realizada: acao === 'realizar' ? realizadaEm : null,
    origem_id: l.id,
    marmoraria_id: l.marmoraria_id,
    investimento_id: l.investimento_id,
    criado_por: user.email,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, proxima: somarDias(data, 1) })
}

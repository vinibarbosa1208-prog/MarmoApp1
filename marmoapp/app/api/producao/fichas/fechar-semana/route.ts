import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, getAuthUserId, apiSupabase as supabase } from '@/lib/api-auth'
import { fimExclusivoDaSemana } from '@/lib/producao/semana'
import { carregarPessoas, validarSemana } from '@/lib/producao/ficha-server'

// "Fechar semana": trava as fichas da semana (viram somente leitura) e
// confere que as instalações daquela semana estão de fato na aba Aprovações
// do fechamento de sexta — ou seja, com status 'pendente'.
//
// A ficha já grava instalação como 'pendente' no lançamento, então em
// condições normais não há nada pra "enviar"; o passo existe pra cobrir
// linhas que tenham entrado por outro caminho e pra o gestor ver o total
// que vai pra aprovação antes de travar.
//
// `{ reabrir: true }` destrava (erro de digitação só aparece depois).

export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const usuario_id = await getAuthUserId()

    const body = await req.json().catch(() => ({}))
    const v = validarSemana(body?.semana ? String(body.semana) : null)
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
    const semana = v.semana
    const reabrir = body?.reabrir === true

    if (reabrir) {
      const { data, error } = await supabase
        .from('fichas_producao')
        .update({ status: 'aberta', fechada_em: null, fechada_por: null })
        .eq('marmoraria_id', marmoraria_id)
        .eq('semana_inicio', semana)
        .eq('status', 'fechada')
        .select('id')
      if (error) throw error
      return NextResponse.json({ ok: true, reabertas: (data ?? []).length })
    }

    // Garante uma ficha por pessoa antes de fechar — quem não teve nenhum
    // lançamento também fecha a semana (e fica registrado que fechou vazia).
    const pessoas = await carregarPessoas(marmoraria_id)
    if (pessoas.length > 0) {
      const { data: existentes } = await supabase
        .from('fichas_producao')
        .select('pessoa_id')
        .eq('marmoraria_id', marmoraria_id)
        .eq('semana_inicio', semana)
      const jaTem = new Set((existentes ?? []).map(f => f.pessoa_id))
      const faltando = pessoas
        .filter(p => !jaTem.has(p.pessoaId))
        .map(p => ({ marmoraria_id, pessoa_id: p.pessoaId, semana_inicio: semana }))
      if (faltando.length) {
        const { error } = await supabase.from('fichas_producao').insert(faltando)
        if (error && !/duplicate key|unique/i.test(error.message)) throw error
      }
    }

    const { data: fechadas, error: fechaErr } = await supabase
      .from('fichas_producao')
      .update({ status: 'fechada', fechada_em: new Date().toISOString(), fechada_por: usuario_id })
      .eq('marmoraria_id', marmoraria_id)
      .eq('semana_inicio', semana)
      .eq('status', 'aberta')
      .select('id')
    if (fechaErr) throw fechaErr

    // Instalações da semana que vão pra Aprovações. Uma linha de instalação
    // sem valor calculado nunca deveria existir (a API recusa no
    // lançamento); se existir, é sinalizada em vez de ser fechada em
    // silêncio — o gestor precisa saber antes do pagamento.
    const { data: instalacoes, error: instErr } = await supabase
      .from('producao_apontamentos')
      .select('id, status, valor_calculado, quantidade')
      .eq('marmoraria_id', marmoraria_id)
      .eq('etapa', 'instalacao')
      .neq('status', 'rejeitado')
      .gte('data', semana)
      .lt('data', fimExclusivoDaSemana(semana))
    if (instErr) throw instErr

    const pendentes = (instalacoes ?? []).filter(i => i.status === 'pendente')
    const semValor = pendentes.filter(i => !i.valor_calculado || Number(i.valor_calculado) <= 0)

    return NextResponse.json({
      ok: true,
      semana,
      fichas_fechadas: (fechadas ?? []).length,
      instalacoes_para_aprovacao: pendentes.length,
      valor_para_aprovacao: pendentes.reduce((s, i) => s + Number(i.valor_calculado ?? 0), 0),
      instalacoes_sem_valor: semValor.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[fichas/fechar-semana] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

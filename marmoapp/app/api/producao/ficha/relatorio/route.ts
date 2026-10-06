import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { diasDaSemana, fimExclusivoDaSemana } from '@/lib/producao/semana'
import { carregarPessoas, validarSemana } from '@/lib/producao/ficha-server'
import { mlEquivalente, type ApontamentoCapacidade } from '@/lib/capacidade'
import { divergenteDemais } from '@/lib/producao/quantidade-sistema'

// Relatório semanal da ficha — grade igual à da presença: linhas =
// pessoas, colunas = Seg a Sáb, mais os totais da semana.
//
// Dois destaques que são a ferramenta de correção das primeiras semanas:
//  - dia com presença e SEM produção → amarelo (faltou lançar a ficha)
//  - produção em dia marcado como falta → vermelho (provável erro de dia)

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const v = validarSemana(req.nextUrl.searchParams.get('semana'))
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
    const semana = v.semana
    const dias = diasDaSemana(semana)
    const fim = fimExclusivoDaSemana(semana)

    const [{ data: marmoraria }, pessoas] = await Promise.all([
      supabase.from('marmorarias').select('fator_meia_esquadria').eq('id', marmoraria_id).maybeSingle(),
      carregarPessoas(marmoraria_id, { incluirInativos: true }),
    ])
    const fatorME = Number(marmoraria?.fator_meia_esquadria ?? 1) || 1

    const cadastroParaPessoa = new Map<string, string>()
    for (const p of pessoas) for (const c of p.cadastros) cadastroParaPessoa.set(c.id, p.pessoaId)
    const cadastroIds = [...cadastroParaPessoa.keys()]

    if (cadastroIds.length === 0) {
      return NextResponse.json({ semana, dias, pessoas: [] })
    }

    const [apontRes, presRes, fichasRes] = await Promise.all([
      supabase
        .from('producao_apontamentos')
        .select('etapa, data, quantidade, quantidade_sistema, tipo_acabamento, funcionario_id, status, valor_calculado')
        .eq('marmoraria_id', marmoraria_id)
        .in('funcionario_id', cadastroIds)
        .neq('status', 'rejeitado')
        .gte('data', semana)
        .lt('data', fim),
      supabase
        .from('funcionario_presencas')
        .select('funcionario_id, data, presente, valor_diaria')
        .eq('marmoraria_id', marmoraria_id)
        .in('funcionario_id', cadastroIds)
        .gte('data', semana)
        .lt('data', fim),
      supabase
        .from('fichas_producao')
        .select('pessoa_id, status, arquivo_url')
        .eq('marmoraria_id', marmoraria_id)
        .eq('semana_inicio', semana),
    ])
    if (apontRes.error) throw apontRes.error
    if (presRes.error) throw presRes.error
    if (fichasRes.error) throw fichasRes.error

    const fichaPorPessoa = new Map((fichasRes.data ?? []).map(f => [f.pessoa_id, f]))

    const linhas = (apontRes.data ?? []).map(a => ({ ...a, quantidade: Number(a.quantidade ?? 0) }))

    const resultado = pessoas.map(pessoa => {
      const ids = new Set(pessoa.cadastros.map(c => c.id))
      const minhasLinhas = linhas.filter(l => l.funcionario_id && ids.has(l.funcionario_id))
      const minhasPresencas = (presRes.data ?? []).filter(p => ids.has(p.funcionario_id))

      const celulas = dias.map(dia => {
        const doDia = minhasLinhas.filter(l => l.data === dia)
        const presDoDia = minhasPresencas.filter(p => p.data === dia)
        // Dois cadastros no mesmo dia são a mesma diária, não duas.
        const presente = presDoDia.some(p => p.presente)
        const temPresenca = presDoDia.length > 0
        const diaria = presente ? Math.max(0, ...presDoDia.filter(p => p.presente).map(p => Number(p.valor_diaria ?? 0))) : 0

        const acab = doDia.filter(l => l.etapa === 'acabamento')
        const mlEq = mlEquivalente(acab as ApontamentoCapacidade[], fatorME)
        const m2 = doDia.filter(l => l.etapa === 'corte').reduce((s, l) => s + l.quantidade, 0)
        const mlInst = doDia.filter(l => l.etapa === 'instalacao').reduce((s, l) => s + l.quantidade, 0)
        const temProducao = doDia.length > 0

        return {
          data: dia,
          presenca: temPresenca ? (presente ? 'P' : 'F') : null,
          valor_diaria: diaria,
          ml_eq: mlEq,
          m2,
          ml_instalado: mlInst,
          valor_instalacao: doDia.filter(l => l.etapa === 'instalacao').reduce((s, l) => s + Number(l.valor_calculado ?? 0), 0),
          linhas: doDia.length,
          // Presente e sem nada lançado: a ficha daquele dia não foi digitada.
          alerta_sem_producao: presente && !temProducao,
          // Produção num dia marcado como falta: quase sempre o dia errado
          // na digitação, ou a presença lançada errada.
          alerta_producao_em_falta: temPresenca && !presente && temProducao,
          divergencias: doDia.filter(l => divergenteDemais(l.quantidade, l.quantidade_sistema != null ? Number(l.quantidade_sistema) : null)).length,
        }
      })

      const diasPresentes = celulas.filter(c => c.presenca === 'P').length
      const totalMlEq = celulas.reduce((s, c) => s + c.ml_eq, 0)
      const totalM2 = celulas.reduce((s, c) => s + c.m2, 0)
      const totalMlInst = celulas.reduce((s, c) => s + c.ml_instalado, 0)
      const totalDiarias = celulas.reduce((s, c) => s + c.valor_diaria, 0)
      // Custo por ml só dos dias que têm diária E acabamento — mesmo
      // critério de lib/capacidade.ts, pra os dois números baterem.
      const diasComCusto = celulas.filter(c => c.valor_diaria > 0 && c.ml_eq > 0)
      const custoMl = diasComCusto.length
        ? diasComCusto.reduce((s, c) => s + c.valor_diaria, 0) / diasComCusto.reduce((s, c) => s + c.ml_eq, 0)
        : null

      const ficha = fichaPorPessoa.get(pessoa.pessoaId)

      return {
        pessoaId: pessoa.pessoaId,
        nome: pessoa.nome,
        modelo: pessoa.modelo,
        ficha_status: ficha?.status ?? 'aberta',
        tem_arquivo: !!ficha?.arquivo_url,
        celulas,
        totais: {
          dias_presentes: diasPresentes,
          ml_eq: totalMlEq,
          m2: totalM2,
          ml_instalado: totalMlInst,
          valor_diarias: totalDiarias,
          media_ml_eq_por_dia: diasPresentes > 0 ? totalMlEq / diasPresentes : null,
          media_m2_por_dia: diasPresentes > 0 ? totalM2 / diasPresentes : null,
          custo_por_ml: custoMl,
          valor_instalacao_a_receber: celulas.reduce((s, c) => s + c.valor_instalacao, 0),
          dias_sem_lancamento: celulas.filter(c => c.alerta_sem_producao).length,
          divergencias: celulas.reduce((s, c) => s + c.divergencias, 0),
        },
      }
    })

    return NextResponse.json({ semana, dias, fator_meia_esquadria: fatorME, pessoas: resultado })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[producao/ficha/relatorio] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

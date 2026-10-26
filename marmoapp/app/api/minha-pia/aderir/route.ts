import { NextRequest, NextResponse } from 'next/server'
import { apiSupabase as supabase } from '@/lib/api-auth'
import { getProgramadoMarmorariaId, carregarConfig, hashPin, pinValido, abrirSessao, errMsg } from '@/lib/minha-pia/servidor'
import { cpfValido, whatsappValido, soDigitos, opcoesParcela } from '@/lib/minha-pia/regras'
import { carregarAdesao, gerarCobranca } from '@/lib/minha-pia/cobranca'

const txt = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// POST público — cria a adesão, abre a sessão e já gera o Pix da 1ª parcela.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = getProgramadoMarmorariaId()
    const config = await carregarConfig(marmoraria_id)
    if (!config.ativo) return NextResponse.json({ error: 'As adesões estão fechadas no momento.' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const nome = txt(b.nome, 120)
    const cpf = soDigitos(b.cpf)
    const whatsapp = soDigitos(b.whatsapp)
    const cidade = txt(b.cidade, 80)
    const valor_parcela = Number(b.valor_parcela)
    const dia_vencimento = Number(b.dia_vencimento)

    if (nome.split(/\s+/).length < 2) return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 })
    if (!cpfValido(cpf)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    if (!whatsappValido(whatsapp)) return NextResponse.json({ error: 'WhatsApp inválido. Use DDD + número com 9 dígitos.' }, { status: 400 })
    if (!pinValido(b.pin)) return NextResponse.json({ error: 'Crie um PIN de 4 números (não use 1234 nem números repetidos).' }, { status: 400 })
    if (b.aceite !== true) return NextResponse.json({ error: 'É preciso aceitar as regras do plano.' }, { status: 400 })
    if (!config.cidades_atendidas.includes(cidade)) return NextResponse.json({ error: 'Ainda não atendemos essa cidade.' }, { status: 400 })
    if (![5, 10, 15, 20, 25].includes(dia_vencimento)) return NextResponse.json({ error: 'Dia de vencimento inválido.' }, { status: 400 })
    if (!txt(b.endereco) || !txt(b.numero_endereco, 20) || !txt(b.bairro)) return NextResponse.json({ error: 'Preencha o endereço completo.' }, { status: 400 })

    const { data: kit } = await supabase.from('programado_kits')
      .select('id, nome, preco_total').eq('marmoraria_id', marmoraria_id).eq('codigo', txt(b.kit_codigo, 60)).eq('ativo', true).maybeSingle()
    if (!kit) return NextResponse.json({ error: 'Escolha uma das pias disponíveis.' }, { status: 400 })
    if (!opcoesParcela(Number(kit.preco_total), config.parcelas_opcoes).includes(valor_parcela)) {
      return NextResponse.json({ error: 'Valor de parcela inválido para essa pia.' }, { status: 400 })
    }

    const { data: existente } = await supabase.from('programado_adesoes').select('id')
      .eq('marmoraria_id', marmoraria_id).eq('cpf', cpf).not('status', 'in', '(instalada,cancelada)').maybeSingle()
    if (existente) {
      return NextResponse.json({ error: 'Este CPF já tem um plano em andamento. Entre com seu CPF e PIN.', codigo: 'ja_cadastrado' }, { status: 409 })
    }

    const utm = (b.utm && typeof b.utm === 'object') ? b.utm as Record<string, unknown> : {}
    const endereco = txt(b.endereco)
    const numero_endereco = txt(b.numero_endereco, 20)
    const bairro = txt(b.bairro, 80)
    const complemento = txt(b.complemento, 80) || null
    const cep = soDigitos(b.cep).slice(0, 8) || null
    const email = txt(b.email, 120).toLowerCase() || null

    // Cadastro em Clientes, para o pedido seguir o fluxo normal depois.
    const { data: cliente } = await supabase.from('clientes').insert({
      marmoraria_id, nome, tipo: 'pf', cpf_cnpj: cpf, whatsapp, telefone: whatsapp, email, cep,
      endereco: [endereco, numero_endereco, complemento, bairro].filter(Boolean).join(', '),
      cidade, estado: 'SP', origem: 'pia programada', ativo: true,
      observacoes: `Pia Programada — ${kit.nome}`,
    }).select('id').single()

    const { data: nova, error } = await supabase.from('programado_adesoes').insert({
      marmoraria_id, kit_id: kit.id, cliente_id: cliente?.id ?? null, kit_nome: kit.nome,
      valor_total: kit.preco_total, valor_parcela, dia_vencimento,
      nome, cpf, whatsapp, email, cep, endereco, numero_endereco, complemento, bairro, cidade,
      pin_hash: await hashPin(b.pin),
      utm_source: txt(utm.utm_source, 100) || null, utm_medium: txt(utm.utm_medium, 100) || null,
      utm_campaign: txt(utm.utm_campaign, 150) || null, utm_content: txt(utm.utm_content, 150) || null,
      fbclid: txt(utm.fbclid, 300) || null,
      aceite_termos_em: new Date().toISOString(),
    }).select('id').single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Este CPF já tem um plano em andamento.', codigo: 'ja_cadastrado' }, { status: 409 })
      throw error
    }

    await abrirSessao(nova.id)

    // 1ª parcela já sai gerada; se falhar (Asaas fora), o painel tenta de novo.
    try {
      const adesao = await carregarAdesao(nova.id, marmoraria_id)
      if (adesao) await gerarCobranca(adesao, 'parcela')
    } catch (e) {
      console.error('[minha-pia/aderir] cobrança inicial', errMsg(e))
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[minha-pia/aderir]', errMsg(e))
    return NextResponse.json({ error: 'Não foi possível concluir agora. Tente de novo em instantes.' }, { status: 500 })
  }
}

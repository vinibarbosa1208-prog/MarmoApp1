import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runAntonio } from '@/lib/antonio/agent'
import { sendWhatsAppText, jidToPhone } from '@/lib/antonio/whatsapp'
import { transcribeAudio } from '@/lib/antonio/stt'
import {
  obterSessao, historico, registrarMensagem, passarParaHumano, humanoAtivo,
  normalizarTelefone, variantesTelefone, telefoneParaJid, type ModoAntonio, type Sessao,
} from '@/lib/antonio/conversa'
import { instrucoesVendas, instrucoesAtendimento } from '@/lib/antonio/modos'
import { separarResposta, lerItensPreOrcamento } from '@/lib/antonio/marcadores'
import {
  carregarCatalogoPublico, calcularFaixa, textoFaixa, agendaOcupada, agoraBrasilia, brasiliaParaIso,
} from '@/lib/antonio/atendimento'

/**
 * Webhook da Evolution API.
 * - Instância igual a MARMORARIA_IA_INSTANCE → modo vendas (leads de marmorarias para a MarmorarIA).
 * - Instância cadastrada em marmorarias.evolution_instance_name → modo atendimento (clientes finais).
 * Exige ?token= igual a ANTONIO_WEBHOOK_TOKEN.
 */

function db(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_KEY não configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export async function GET() {
  return NextResponse.json({ status: 'Agente Antônio webhook ativo' })
}

interface Tenant { id: string; nome: string; cidade: string | null; telefone: string | null; modo: ModoAntonio }

async function resolverTenant(sb: SupabaseClient, instance: string): Promise<Tenant | null> {
  if (process.env.MARMORARIA_IA_INSTANCE && instance === process.env.MARMORARIA_IA_INSTANCE) {
    const id = process.env.MARMORARIA_IA_MARMORARIA_ID
    if (!id) return null
    return { id, nome: 'MarmorarIA', cidade: null, telefone: process.env.MARMORARIA_IA_DONO_WHATSAPP || null, modo: 'vendas' }
  }
  const { data } = await sb
    .from('marmorarias')
    .select('id, nome, cidade, telefone, ativo')
    .eq('evolution_instance_name', instance)
    .maybeSingle()
  if (!data || data.ativo === false) return null
  return { id: data.id, nome: data.nome, cidade: data.cidade, telefone: data.telefone, modo: 'atendimento' }
}

async function extrairTexto(data: Record<string, unknown>): Promise<string> {
  const msg = (data.message || {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const texto = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.documentMessage?.caption || ''
  if (texto) return msg.imageMessage ? `[enviou uma foto] ${texto}` : texto
  if (msg.imageMessage) return '[enviou uma foto]'
  if (msg.audioMessage) {
    const b64 = (msg.base64 || (data as any).base64) as string | undefined // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!b64) return '[enviou um áudio que não pôde ser ouvido]'
    try {
      const bytes = Buffer.from(b64, 'base64')
      return await transcribeAudio(new Blob([bytes], { type: 'audio/ogg' }), 'audio.ogg')
    } catch {
      return '[enviou um áudio que não pôde ser ouvido]'
    }
  }
  return ''
}

async function avisarDono(instance: string, tenant: Tenant, texto: string) {
  const fone = normalizarTelefone(tenant.telefone)
  if (!fone) return
  await sendWhatsAppText({ instance, to: telefoneParaJid(fone), text: `[Antônio] ${texto}` })
}

async function acharCliente(sb: SupabaseClient, marmorariaId: string, phone: string) {
  const { data } = await sb.from('clientes').select('id, nome, whatsapp, telefone').eq('marmoraria_id', marmorariaId)
  const alvos = new Set(variantesTelefone(phone))
  return (data || []).find(c => alvos.has(normalizarTelefone(c.whatsapp)) || alvos.has(normalizarTelefone(c.telefone))) || null
}

export async function POST(req: NextRequest) {
  const token = process.env.ANTONIO_WEBHOOK_TOKEN
  if (!token || req.nextUrl.searchParams.get('token') !== token) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const data = (body.data || {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    const from: string = data.key?.remoteJid || ''
    const instance: string = body.instance || ''
    if (!from || from.endsWith('@g.us') || from === 'status@broadcast') return NextResponse.json({ ok: true })

    const sb = db()
    const tenant = await resolverTenant(sb, instance)
    if (!tenant) return NextResponse.json({ ok: true })

    const phone = normalizarTelefone(jidToPhone(from))
    const sessao: Sessao = await obterSessao(sb, tenant.id, phone, tenant.modo)

    // Mensagem enviada pela própria equipe no celular: um humano assumiu a conversa.
    if (data.key?.fromMe) {
      const texto = await extrairTexto(data)
      // Mensagens que o próprio Antônio enviou também chegam como fromMe; elas já estão registradas.
      const { data: ultima } = await sb
        .from('antonio_messages').select('content').eq('session_id', sessao.id)
        .eq('role', 'assistant').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (texto && ultima?.content?.trim() !== texto.trim()) {
        await registrarMensagem(sb, sessao.id, 'humano', texto)
        await passarParaHumano(sb, sessao.id)
      }
      return NextResponse.json({ ok: true })
    }

    const texto = await extrairTexto(data)
    if (!texto.trim()) return NextResponse.json({ ok: true })

    await registrarMensagem(sb, sessao.id, 'user', texto)
    if (humanoAtivo(sessao)) return NextResponse.json({ ok: true })

    // Instruções da frente certa
    let system: string
    let catalogo: Awaited<ReturnType<typeof carregarCatalogoPublico>> | null = null
    if (tenant.modo === 'vendas') {
      system = instrucoesVendas(agoraBrasilia())
    } else {
      catalogo = await carregarCatalogoPublico(sb, tenant.id)
      system = instrucoesAtendimento({
        nomeMarmoraria: tenant.nome,
        cidade: tenant.cidade,
        agoraTexto: agoraBrasilia(),
        catalogo: catalogo.texto,
        agendaOcupada: await agendaOcupada(sb, tenant.id),
      })
    }

    const msgs = await historico(sb, sessao.id)
    const { texto: bruto, tokens } = await runAntonio(system, msgs.length ? msgs : [{ role: 'user', content: texto }])
    const { texto: resposta, marcadores } = separarResposta(bruto)

    let final = resposta

    // Pré-orçamento: o servidor recalcula com o catálogo e escreve a faixa.
    if (marcadores.PREORCAMENTO && catalogo) {
      const itens = lerItensPreOrcamento(marcadores.PREORCAMENTO)
      if (itens.length) {
        const faixa = calcularFaixa(itens, catalogo)
        final = `${resposta}\n\n${textoFaixa(faixa.minimo, faixa.maximo)}`
        await sb.from('antonio_quotes').insert({
          session_id: sessao.id,
          marmoraria_id: tenant.id,
          input_text: texto,
          raw_json: { ...marcadores.PREORCAMENTO, calculo: faixa },
          status: faixa.todosConferidos ? 'pre_orcamento' : 'pre_orcamento_conferir',
        })
      }
    }

    if (final) {
      await sendWhatsAppText({ instance, to: from, text: final })
      await registrarMensagem(sb, sessao.id, 'assistant', final, tokens)
    }

    // Medição marcada → agenda + aviso ao dono
    if (marcadores.MEDICAO && tenant.modo === 'atendimento') {
      const m = marcadores.MEDICAO as Record<string, string>
      const inicio = brasiliaParaIso(m.data_hora || '')
      if (inicio) {
        const { data: tipos } = await sb.from('agenda_event_types').select('id, nome').eq('marmoraria_id', tenant.id)
        const tipo = (tipos || []).find(t => /medi|visita/i.test(t.nome))
        const cliente = await acharCliente(sb, tenant.id, phone)
        await sb.from('agenda_events').insert({
          marmoraria_id: tenant.id,
          tipo_id: tipo?.id || null,
          titulo: `Medição — ${m.nome_cliente || cliente?.nome || phone}`,
          descricao: [m.endereco, m.observacao, `WhatsApp: +${phone}`, 'Marcada pelo Antônio'].filter(Boolean).join('\n'),
          data_inicio: inicio,
          data_fim: new Date(new Date(inicio).getTime() + 3600_000).toISOString(),
          dia_inteiro: false,
          cliente_id: cliente?.id || null,
          status: 'agendado',
        })
        await avisarDono(instance, tenant, `Medição marcada: ${m.nome_cliente || phone}, ${m.data_hora.replace('T', ' às ')}. ${m.endereco || ''} ${m.observacao || ''}`.trim())
      }
    }

    // Cliente sem interesse → orçamento aberto vira perdido
    if (marcadores.PERDIDO && tenant.modo === 'atendimento') {
      const cliente = await acharCliente(sb, tenant.id, phone)
      if (cliente) {
        await sb.from('orcamentos')
          .update({ crm_status: 'perdido', crm_notas: `Antônio: ${(marcadores.PERDIDO as Record<string, string>).motivo || 'sem interesse'}` })
          .eq('marmoraria_id', tenant.id).eq('cliente_id', cliente.id)
          .in('status', ['rascunho', 'enviado'])
      }
    }

    // Lead de marmoraria (frente de vendas)
    if (marcadores.LEAD && tenant.modo === 'vendas') {
      const l = marcadores.LEAD as Record<string, string | null>
      const lead = {
        nome_contato: l.nome || `WhatsApp +${phone}`,
        nome_marmoraria: l.marmoraria || null,
        whatsapp: phone,
        email: '',
        tamanho_equipe: l.funcionarios || null,
        origem: `antonio_whatsapp${l.classificacao ? `_${l.classificacao}` : ''}${l.demo ? '_demo' : ''}`,
        status: l.demo ? 'contactado' : 'novo',
      }
      const { data: existente } = await sb.from('leads').select('id').eq('whatsapp', phone).limit(1).maybeSingle()
      if (existente) await sb.from('leads').update(lead).eq('id', existente.id)
      else await sb.from('leads').insert(lead)
      if (l.demo) {
        await avisarDono(instance, tenant, `Demo marcada: ${l.nome || ''} (${l.marmoraria || ''}, ${l.cidade || ''}) em ${String(l.demo).replace('T', ' às ')}. ${l.funcionarios || '?'} pessoas, ${l.orcamentos_mes || '?'} orçamentos/mês. +${phone}`)
      }
    }

    // Passa para humano
    if (marcadores.HUMANO) {
      await passarParaHumano(sb, sessao.id)
      await avisarDono(instance, tenant, `Conversa com +${phone} precisa de você: ${(marcadores.HUMANO as Record<string, string>).motivo || 'pedido do cliente'}. O Antônio pausou nesta conversa por 12h.`)
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[antonio/webhook] error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

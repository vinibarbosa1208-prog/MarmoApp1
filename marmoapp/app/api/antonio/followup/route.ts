import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/antonio/whatsapp'
import { mensagemFollowup, type EtapaFollowup } from '@/lib/antonio/modos'
import { normalizarTelefone, telefoneParaJid, obterSessao, registrarMensagem } from '@/lib/antonio/conversa'

/**
 * Follow-up de orçamentos parados (sem falar de pagamento).
 * Roda uma vez por dia (Vercel Cron). Só atua nas marmorarias listadas em
 * ANTONIO_FOLLOWUP_ATIVO_PARA (ids separados por vírgula). Com
 * ANTONIO_FOLLOWUP_SIMULAR=1, registra o que enviaria sem mandar nada.
 *
 * Etapas por dias desde a emissão: 2, 7, 15, 30.
 * Orçamento com mais de 30 dias e nenhum follow-up: "retomada"; 15 dias depois, "encerrar".
 * No máximo uma mensagem por orçamento por dia; nunca aos domingos.
 */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIA = 86400_000

function diasDesde(dataIso: string, hoje: Date) {
  return Math.floor((hoje.getTime() - new Date(`${dataIso.slice(0, 10)}T12:00:00-03:00`).getTime()) / DIA)
}

function proximaEtapa(dias: number, feitas: Map<EtapaFollowup, string>, hoje: Date): EtapaFollowup | null {
  if (feitas.has('d30') || feitas.has('encerrar')) return null
  if (feitas.has('retomada')) {
    const quando = new Date(feitas.get('retomada')!)
    return (hoje.getTime() - quando.getTime()) / DIA >= 15 ? 'encerrar' : null
  }
  if (feitas.size === 0 && dias > 32) return 'retomada'
  const devidas: [EtapaFollowup, number][] = [['d30', 30], ['d15', 15], ['d7', 7], ['d2', 2]]
  for (const [etapa, min] of devidas) {
    if (dias >= min && !feitas.has(etapa)) return etapa
  }
  return null
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const ativos = (process.env.ANTONIO_FOLLOWUP_ATIVO_PARA || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ativos.length) return NextResponse.json({ ok: true, motivo: 'nenhuma marmoraria ativa' })

  const hoje = new Date()
  const diaSemana = new Date(hoje.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()
  if (diaSemana === 0) return NextResponse.json({ ok: true, motivo: 'domingo' })

  const simular = process.env.ANTONIO_FOLLOWUP_SIMULAR === '1'
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  const resumo: Record<string, number> = {}

  for (const marmorariaId of ativos) {
    const { data: m } = await sb.from('marmorarias').select('id, nome, evolution_instance_name').eq('id', marmorariaId).maybeSingle()
    if (!m?.evolution_instance_name) continue

    const { data: orcs } = await sb
      .from('orcamentos')
      .select('id, titulo, data_emissao, created_at, status, crm_status, cliente:clientes(id, nome, whatsapp, telefone)')
      .eq('marmoraria_id', marmorariaId)
      .in('status', ['enviado', 'rascunho'])
      .not('crm_status', 'in', '(perdido,fechado)')

    const candidatos = (orcs || []).filter(o => o.status === 'enviado' || o.crm_status === 'enviado' || o.crm_status === 'em_negociacao')
    if (!candidatos.length) continue

    const { data: feitasRows } = await sb
      .from('antonio_followups').select('orcamento_id, etapa, enviado_em')
      .in('orcamento_id', candidatos.map(o => o.id))
      .eq('status', 'enviado')
    const feitasPorOrc = new Map<string, Map<EtapaFollowup, string>>()
    for (const f of feitasRows || []) {
      const mapa = feitasPorOrc.get(f.orcamento_id) || new Map()
      mapa.set(f.etapa as EtapaFollowup, f.enviado_em)
      feitasPorOrc.set(f.orcamento_id, mapa)
    }

    const jaContatados = new Set<string>()
    for (const o of candidatos) {
      const cliente = (Array.isArray(o.cliente) ? o.cliente[0] : o.cliente) as { id: string; nome: string; whatsapp: string | null; telefone: string | null } | null
      const phone = normalizarTelefone(cliente?.whatsapp || cliente?.telefone)
      if (!cliente || phone.length < 12 || jaContatados.has(phone)) continue

      const emissao = o.data_emissao || o.created_at
      const etapa = proximaEtapa(diasDesde(emissao, hoje), feitasPorOrc.get(o.id) || new Map(), hoje)
      if (!etapa) continue

      const data = new Date(`${emissao.slice(0, 10)}T12:00:00-03:00`)
      const texto = mensagemFollowup(etapa, {
        nome: (cliente.nome || '').trim().split(/\s+/)[0] || '',
        peca: (o.titulo || 'o seu orçamento').toLowerCase(),
        marmoraria: m.nome,
        mesOrcamento: MESES[data.getMonth()],
      })

      let status: 'enviado' | 'falhou' | 'simulado' = 'simulado'
      if (!simular) {
        const ok = await sendWhatsAppText({ instance: m.evolution_instance_name, to: telefoneParaJid(phone), text: texto })
        status = ok ? 'enviado' : 'falhou'
        if (ok) {
          const sessao = await obterSessao(sb, marmorariaId, phone, 'atendimento')
          await registrarMensagem(sb, sessao.id, 'assistant', texto)
        }
      }

      await sb.from('antonio_followups').upsert(
        { marmoraria_id: marmorariaId, orcamento_id: o.id, etapa, phone, texto, status, enviado_em: new Date().toISOString() },
        { onConflict: 'orcamento_id,etapa' },
      )
      jaContatados.add(phone)
      resumo[status] = (resumo[status] || 0) + 1
    }
  }

  return NextResponse.json({ ok: true, simular, resumo })
}

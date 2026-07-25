import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET

// Palavras-chave que o funcionário pode enviar para registrar presença
const PALAVRAS_PRESENCA = ['presença', 'presenca', 'presente', 'bom dia', 'cheguei', 'aqui']

// Normaliza telefone para só dígitos, removendo código do país 55
function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  // Remove prefixo de país 55 se presente e o número tiver 12+ dígitos
  if (digits.startsWith('55') && digits.length >= 12) return digits.slice(2)
  return digits
}

function ehMensagemPresenca(texto: string): boolean {
  const lower = texto.toLowerCase().trim()
  return PALAVRAS_PRESENCA.some(p => lower.startsWith(p) || lower === p)
}

export async function POST(req: NextRequest) {
  try {
    // Valida secret
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-webhook-secret')
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()

    // Extrai dados da payload do n8n (que já processou o webhook da Evolution API)
    const telefone: string = body.telefone ?? ''
    const texto: string = body.texto ?? ''
    const marmoraria_id: string = body.marmoraria_id ?? ''

    if (!telefone || !marmoraria_id) {
      return NextResponse.json({ error: 'telefone e marmoraria_id são obrigatórios' }, { status: 400 })
    }

    // Verifica se é mensagem de presença
    if (!ehMensagemPresenca(texto)) {
      return NextResponse.json({ ok: false, motivo: 'mensagem_ignorada' })
    }

    // Normaliza o telefone recebido
    const telNormalizado = normalizarTelefone(telefone)

    // Busca todos os funcionários ativos da marmoraria
    const { data: funcionarios, error: errFunc } = await supabase
      .from('funcionarios')
      .select('id, nome, telefone, valor_diaria, tipo_pagamento')
      .eq('marmoraria_id', marmoraria_id)
      .eq('ativo', true)

    if (errFunc) throw errFunc

    // Encontra o funcionário pelo telefone normalizado
    const func = (funcionarios ?? []).find(f => {
      if (!f.telefone) return false
      return normalizarTelefone(f.telefone) === telNormalizado
    })

    if (!func) {
      return NextResponse.json({
        ok: false,
        motivo: 'funcionario_nao_encontrado',
        telefone: telNormalizado,
      })
    }

    // Data de hoje no fuso de Brasília
    const hoje = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).split('/').reverse().join('-') // YYYY-MM-DD

    // Registra presença (upsert — idempotente)
    const { data: presenca, error: errPresenca } = await supabase
      .from('funcionario_presencas')
      .upsert(
        {
          marmoraria_id,
          funcionario_id: func.id,
          data: hoje,
          presente: true,
          valor_diaria: func.valor_diaria ?? 0,
        },
        { onConflict: 'funcionario_id,data' }
      )
      .select()
      .single()

    if (errPresenca) throw errPresenca

    return NextResponse.json({
      ok: true,
      nome: func.nome,
      data: hoje,
      valor_diaria: func.valor_diaria ?? 0,
      presenca_id: presenca?.id,
    })

  } catch (e: unknown) {
    console.error('[whatsapp/presenca]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { TIPOS_CLIENTE } from '@/lib/financeiro'

type Ctx = { params: Promise<{ id: string }> }

// Classificação interna da marmoraria (contratante, cadastro, teste, interno).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!TIPOS_CLIENTE.some((t) => t.valor === b.tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  const observacao = typeof b.observacao === 'string' ? b.observacao.trim().slice(0, 500) || null : undefined

  const { error } = await supabaseAdmin.from('admin_clientes').upsert({
    marmoraria_id: id,
    tipo: b.tipo,
    ...(observacao !== undefined ? { observacao } : {}),
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

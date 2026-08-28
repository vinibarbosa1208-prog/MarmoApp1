import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'

// Cria login restrito (perfil='instalador') para um funcionário já cadastrado,
// ligando funcionarios.usuario_id ao novo usuário. Login tradicional (email +
// senha definida pelo gestor aqui) — decisão já tomada, não é link mágico/PIN.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let createdAuthUserId: string | null = null
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')

    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
    if (senha.length < 6) return NextResponse.json({ error: 'Senha precisa de pelo menos 6 caracteres' }, { status: 400 })

    const { data: funcionario, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id, nome, usuario_id')
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .maybeSingle()

    if (funcErr) throw funcErr
    if (!funcionario) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    if (funcionario.usuario_id) return NextResponse.json({ error: 'Este funcionário já tem acesso ao sistema' }, { status: 400 })

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: funcionario.nome },
    })

    if (authErr) {
      const msg = authErr.message?.toLowerCase().includes('already') || authErr.message?.toLowerCase().includes('registered')
        ? 'Já existe uma conta com esse e-mail'
        : authErr.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (!authData.user) throw new Error('Falha ao criar usuário de autenticação')
    createdAuthUserId = authData.user.id

    const { error: usuarioErr } = await supabase.from('usuarios').insert({
      id: authData.user.id,
      marmoraria_id,
      nome: funcionario.nome,
      email,
      perfil: 'instalador',
      ativo: true,
    })
    if (usuarioErr) throw usuarioErr

    const { data: funcAtualizado, error: updErr } = await supabase
      .from('funcionarios')
      .update({ usuario_id: authData.user.id })
      .eq('id', id)
      .eq('marmoraria_id', marmoraria_id)
      .select('id, usuario_id')
      .single()
    if (updErr) throw updErr

    return NextResponse.json({ ok: true, usuario_id: authData.user.id, email, funcionario: funcAtualizado }, { status: 201 })
  } catch (e: unknown) {
    // Compensa: se algo falhou depois de criar o usuário de auth, remove pra
    // não deixar uma conta órfã sem registro em usuarios/funcionarios.
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => {})
      await supabase.from('usuarios').delete().eq('id', createdAuthUserId).then(() => {}, () => {})
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

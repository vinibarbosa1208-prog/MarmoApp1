import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { garantirFicha, validarSemana } from '@/lib/producao/ficha-server'

// Upload opcional da foto/scan da ficha de papel — prova se houver dúvida
// depois. Bucket privado `fichas-producao`, sempre via servidor (nunca
// upload direto do navegador), igual ao padrão de comprovantes-instalacao.
//
// GET  ?pessoa=&semana= → URL assinada pra ver o arquivo já enviado
// POST (multipart)      → envia/substitui o arquivo da ficha

const BUCKET = 'fichas-producao'
const MAX_BYTES = 10 * 1024 * 1024
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

export async function GET(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const pessoa = req.nextUrl.searchParams.get('pessoa')
    const v = validarSemana(req.nextUrl.searchParams.get('semana'))
    if (!pessoa) return NextResponse.json({ error: 'Parâmetro pessoa obrigatório' }, { status: 400 })
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })

    const { data: ficha } = await supabase
      .from('fichas_producao')
      .select('arquivo_url')
      .eq('marmoraria_id', marmoraria_id)
      .eq('pessoa_id', pessoa)
      .eq('semana_inicio', v.semana)
      .maybeSingle()

    if (!ficha?.arquivo_url) return NextResponse.json({ url: null })

    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(ficha.arquivo_url, 3600)
    return NextResponse.json({ url: data?.signedUrl ?? null })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let caminho: string | null = null
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const form = await req.formData()
    const pessoa = String(form.get('pessoa') ?? '')
    const v = validarSemana(String(form.get('semana') ?? ''))
    const arquivo = form.get('arquivo')

    if (!pessoa) return NextResponse.json({ error: 'Pessoa obrigatória' }, { status: 400 })
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }
    if (arquivo.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo acima de 10 MB — tire a foto em resolução menor' }, { status: 400 })
    }
    if (arquivo.type && !TIPOS_OK.includes(arquivo.type)) {
      return NextResponse.json({ error: 'Envie uma imagem (JPG/PNG) ou PDF' }, { status: 400 })
    }

    const ficha = await garantirFicha(marmoraria_id, pessoa, v.semana)

    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    caminho = `${marmoraria_id}/${v.semana}/${pessoa}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), {
        contentType: arquivo.type || 'image/jpeg',
      })
    if (upErr) throw upErr

    const anterior = ficha.arquivo_url

    const { error: updErr } = await supabase
      .from('fichas_producao')
      .update({ arquivo_url: caminho })
      .eq('id', ficha.id)
      .eq('marmoraria_id', marmoraria_id)
    if (updErr) throw updErr

    // Substituição: só apaga o antigo depois que o novo já está apontado.
    if (anterior && anterior !== caminho) {
      await supabase.storage.from(BUCKET).remove([anterior])
    }

    return NextResponse.json({ ok: true, arquivo_url: caminho })
  } catch (e: unknown) {
    // Falhou depois do upload — remove o arquivo órfão.
    if (caminho) await supabase.storage.from(BUCKET).remove([caminho]).catch(() => {})
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro interno')
    console.error('[fichas/arquivo] erro:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getMarmorariaId, apiSupabase as supabase } from '@/lib/api-auth'
import { carregarConfig, errMsg, type FotoObra } from '@/lib/minha-pia/servidor'

const BUCKET = 'programado-fotos'
const MAX_FOTOS = 24
const MAX_BYTES = 8 * 1024 * 1024
const TIPOS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function salvarFotos(marmoraria_id: string, fotos: FotoObra[]) {
  const { error } = await supabase.from('programado_config').upsert({ marmoraria_id, fotos })
  if (error) throw error
}

// POST multipart { arquivo, legenda? } — adiciona uma foto de obra ao site.
export async function POST(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const form = await req.formData()
    const arquivo = form.get('arquivo')
    if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Envie uma imagem' }, { status: 400 })
    const ext = TIPOS[arquivo.type]
    if (!ext) return NextResponse.json({ error: 'Use JPG, PNG ou WEBP' }, { status: 400 })
    if (arquivo.size > MAX_BYTES) return NextResponse.json({ error: 'Imagem acima de 8 MB' }, { status: 400 })

    const config = await carregarConfig(marmoraria_id)
    if (config.fotos.length >= MAX_FOTOS) return NextResponse.json({ error: `Limite de ${MAX_FOTOS} fotos` }, { status: 400 })

    const path = `${marmoraria_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, cacheControl: '31536000' })
    if (upErr) throw upErr
    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const legenda = typeof form.get('legenda') === 'string' ? String(form.get('legenda')).slice(0, 120) || null : null

    const fotos = [...config.fotos, { path, url, legenda, destaque: config.fotos.length === 0 }]
    await salvarFotos(marmoraria_id, fotos)
    return NextResponse.json({ fotos })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

// PUT { fotos: [{ path, legenda, destaque }] } — reordena, edita legenda e destaque.
export async function PUT(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const b = await req.json().catch(() => ({}))
    const config = await carregarConfig(marmoraria_id)
    const porPath = new Map(config.fotos.map(f => [f.path, f]))
    const novas: FotoObra[] = []
    for (const f of (Array.isArray(b.fotos) ? b.fotos : []) as Partial<FotoObra>[]) {
      const atual = f.path ? porPath.get(f.path) : undefined
      if (!atual) continue
      novas.push({ ...atual, legenda: typeof f.legenda === 'string' ? f.legenda.slice(0, 120) || null : atual.legenda, destaque: !!f.destaque })
    }
    // Só uma foto de destaque (a do topo da página).
    let achou = false
    novas.forEach(f => { if (f.destaque && !achou) achou = true; else f.destaque = false })
    if (!achou && novas[0]) novas[0].destaque = true
    await salvarFotos(marmoraria_id, novas)
    return NextResponse.json({ fotos: novas })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

// DELETE ?path=... — remove a foto do site e do armazenamento.
export async function DELETE(req: NextRequest) {
  try {
    const marmoraria_id = await getMarmorariaId(req.headers.get('authorization'))
    if (!marmoraria_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const path = req.nextUrl.searchParams.get('path') || ''
    if (!path.startsWith(marmoraria_id + '/')) return NextResponse.json({ error: 'Foto inválida' }, { status: 400 })
    const config = await carregarConfig(marmoraria_id)
    const fotos = config.fotos.filter(f => f.path !== path)
    if (fotos.length && !fotos.some(f => f.destaque)) fotos[0].destaque = true
    await salvarFotos(marmoraria_id, fotos)
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ fotos })
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 })
  }
}

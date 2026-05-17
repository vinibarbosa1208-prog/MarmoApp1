import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/antonio/stt'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Arquivo de áudio não encontrado' }, { status: 400 })
    }

    const text = await transcribeAudio(audioFile)
    return NextResponse.json({ text })
  } catch (e: unknown) {
    console.error('[antonio/audio] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro na transcrição' },
      { status: 500 }
    )
  }
}

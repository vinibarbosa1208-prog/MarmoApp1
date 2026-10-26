import { NextResponse } from 'next/server'
import { encerrarSessao } from '@/lib/minha-pia/servidor'

export async function POST() {
  await encerrarSessao()
  return NextResponse.json({ ok: true })
}

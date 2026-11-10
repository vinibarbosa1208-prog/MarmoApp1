import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserForApi } from '@/lib/auth-admin'
import { APRESENTACAO_HTML } from '@/lib/apresentacao-html'

// Apresentação de diagnóstico da MarmorarIA, aberta em tela cheia para a call.
// Fica fora do layout do painel; os dados salvos vão para /api/diagnosticos.
export async function GET(request: NextRequest) {
  const user = await getAdminUserForApi()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  return new NextResponse(APRESENTACAO_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}

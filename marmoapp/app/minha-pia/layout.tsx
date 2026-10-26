import type { Metadata } from 'next'
import './minha-pia.css'

// Portal público do cliente final (Pia Programada) — destino do anúncio.
// Sem login do MarmoApp: o cliente entra com CPF + PIN (cookie próprio).
export const metadata: Metadata = {
  title: 'Pia Programada — sua pia de granito por mês',
  description: 'Pia de granito instalada pagando por mês no Pix. Sem cartão e sem consulta.',
}

export default function MinhaPiaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" />
      <div className="mp">{children}</div>
    </>
  )
}

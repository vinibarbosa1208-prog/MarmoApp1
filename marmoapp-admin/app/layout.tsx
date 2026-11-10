import type { Metadata } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: { default: 'MarmoApp · Painel central', template: '%s · MarmoApp' },
  description: 'Painel central do time interno MarmoApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${playfair.variable} h-full`}>
      <body className="h-full bg-page text-gray-900 antialiased">{children}</body>
    </html>
  )
}

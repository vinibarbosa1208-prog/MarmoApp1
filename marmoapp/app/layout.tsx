import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AppProvider } from '@/contexts/AppContext'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'MarmoApp — Gestão de Marmorarias',
  description: 'Gestão inteligente para marmorarias',
  icons: {
    icon: '/logo-marmoapp.jpg',
    shortcut: '/logo-marmoapp.jpg',
    apple: '/logo-marmoapp.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

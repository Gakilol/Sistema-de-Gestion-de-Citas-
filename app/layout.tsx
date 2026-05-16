import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/components/providers/auth-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s — HAIR STYLE Salón & Barber',
    default: 'HAIR STYLE Salón & Barber — Sistema de Gestión',
  },
  description:
    'Plataforma de gestión profesional para HAIR STYLE Salón & Barber. Citas, clientes, empleados y reportes en un solo lugar.',
  keywords: ['barbería', 'salón', 'gestión de citas', 'barbero', 'estilista'],
  authors: [{ name: 'HAIR STYLE Salón & Barber' }],
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster
            position="top-right"
            richColors
            expand
            closeButton
            toastOptions={{
              duration: 4000,
              classNames: {
                toast: 'font-sans text-sm',
              },
            }}
          />
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

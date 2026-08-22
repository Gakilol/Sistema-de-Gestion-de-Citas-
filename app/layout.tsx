import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/components/providers/auth-provider'
import { BRAND } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: `%s — ${BRAND.productName}`,
    default: `${BRAND.productName} — ${BRAND.businessName}`,
  },
  description:
    `Agenda y gestión profesional para ${BRAND.businessName} ${BRAND.descriptor}.`,
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
      <body className="h-full bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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

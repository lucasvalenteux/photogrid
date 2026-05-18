import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { APP_NAME, APP_TAGLINE, APP_URL } from '@photogrid/config';
import { TooltipProvider } from '@photogrid/ui';

import { AuthProvider } from '@/components/providers/auth-provider';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Photogrid é a plataforma onde fotógrafos organizam galerias, compartilham via link e vendem fotos online. Sem planilhas, sem ligações, sem fricção.',
  keywords: [
    'fotógrafo',
    'fotografia escolar',
    'galeria online',
    'vender fotos',
    'photogrid',
    'photo gallery',
  ],
  authors: [{ name: 'Photogrid' }],
  creator: 'Photogrid',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description:
      'Hospede, organize e venda suas fotos com uma plataforma feita para fotógrafos.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description:
      'Hospede, organize e venda suas fotos com uma plataforma feita para fotógrafos.',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AuthProvider>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster
              position="top-center"
              richColors
              toastOptions={{
                style: {
                  borderRadius: '12px',
                  fontFamily: 'var(--font-sans)',
                },
              }}
            />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

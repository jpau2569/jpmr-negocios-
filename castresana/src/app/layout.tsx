import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

/* Tipografías: serif editorial para display (premium), sans neutra para UI. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Castresana — Gestión inmobiliaria premium',
    template: '%s · Castresana',
  },
  description:
    'Inbox unificado, propiedades y leads para inmobiliaria premium. PWA rápida y sobria.',
  applicationName: 'Castresana',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Castresana',
  },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/icon.svg' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#131110',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

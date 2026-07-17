import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '@/components/providers/FirebaseProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ServiceWorkerRegistrar } from '@/components/shared';

/* Tipografía: Fraunces (serif editorial, display) + Manrope (sans humanista, UI).
   Ninguna de las dos huele a plantilla; juntas dan el tono premium-cálido. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Castresana — Inbox inmobiliario',
    template: '%s · Castresana',
  },
  description:
    'Software interno de Asesoría Castresana (Oviedo): leads, conversaciones y propiedades en un solo lugar.',
  applicationName: 'Castresana',
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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#100E0C' },
    { media: '(prefers-color-scheme: light)', color: '#E7E0D2' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/* Aplica el tema guardado ANTES del primer paint (evita flash de tema).
   Debe coincidir con THEME_STORAGE_KEY de lib/constants/nav.ts. */
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('castresana-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" className={`${fraunces.variable} ${manrope.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <FirebaseProvider>
          <AuthProvider>{children}</AuthProvider>
        </FirebaseProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

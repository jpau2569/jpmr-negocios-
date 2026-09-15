import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Tipografía: pila del sistema, sin webfont.
 *
 * Es una decisión, no un olvido. La página se abre desde un cartel, con datos
 * móviles y a menudo con mala cobertura: ahorrar dos peticiones de fuente y
 * evitar el parpadeo del texto vale más que una tipografía de marca. En iOS y
 * Android la pila del sistema ya es San Francisco y Roboto, ambas excelentes
 * para leer en pantalla pequeña.
 */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL_APP ?? "http://localhost:3000"),
  title: {
    default: "PULSO LOCAL AI — El QR que convierte visitas en clientes que vuelven",
    template: "%s · PULSO LOCAL AI",
  },
  description:
    "Un punto de captación y seguimiento en cada cartel, vivienda, escaparate, dossier y visita. Para inmobiliarias, asesorías y administradores de fincas.",
  applicationName: "PULSO LOCAL AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Pulso Local", statusBarStyle: "black-translucent" },
  icons: { icon: "/icono.svg", apple: "/icono.svg" },
  openGraph: {
    type: "website",
    siteName: "PULSO LOCAL AI",
    title: "PULSO LOCAL AI",
    description: "El QR que convierte visitas en clientes que vuelven.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E2A3F" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1620" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--marca)] focus:px-4 focus:py-2 focus:text-[var(--marca-contraste)]"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}

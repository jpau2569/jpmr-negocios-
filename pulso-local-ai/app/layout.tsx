import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pulso Local AI",
    template: "%s · Pulso Local AI",
  },
  description: "El QR que convierte visitas en clientes que vuelven.",
  applicationName: "Pulso Local AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: "#17181b",
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: impedir el zoom rompe la accesibilidad AA, y quien lee
  // una carta en el móvil a menudo necesita ampliar.
  viewportFit: "cover",
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

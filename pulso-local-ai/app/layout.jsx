import "./globals.css";
export const metadata = {
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
export const viewport = {
    themeColor: "#17181b",
    width: "device-width",
    initialScale: 1,
    // Sin maximumScale: impedir el zoom rompe la accesibilidad AA, y quien lee
    // una carta en el móvil a menudo necesita ampliar.
    viewportFit: "cover",
};
export default function LayoutRaiz({ children }) {
    return (<html lang="es">
      <body>{children}</body>
    </html>);
}

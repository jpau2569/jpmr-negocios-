import path from "node:path";
import type { NextConfig } from "next";

/**
 * Las fotos de los inmuebles las sube el negocio a Supabase Storage, pero en la
 * demo hay imágenes de ejemplo servidas desde dominios públicos. Solo se permiten
 * dominios explícitos: `next/image` no debe convertirse en un proxy abierto.
 */
const dominiosImagen = (process.env.NEXT_PUBLIC_DOMINIOS_IMAGEN ?? "images.unsplash.com")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Esta aplicación vive dentro de un monorepo con otro `package-lock.json` en la
  // raíz. Sin esto, Next deduce mal cuál es la raíz del proyecto y avisa en cada
  // arranque (y en Vercel puede acabar trazando ficheros que no son suyos).
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [...new Set([...dominiosImagen, supabaseHost].filter(Boolean) as string[])].map(
      (hostname) => ({ protocol: "https" as const, hostname }),
    ),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;

import Link from "next/link";
import { slugsConocidos, leerEspacio } from "@/lib/datos";
import { qrSvg, urlDeQr } from "@/lib/qr";

// ============================================================================
//  Portada — el hub comercial
// ----------------------------------------------------------------------------
//  No es la home de un producto: es la pantalla que Pau abre delante de un
//  hostelero. De aquí salen el enlace y el QR que se mandan por WhatsApp.
// ============================================================================

export const dynamic = "force-dynamic";

export default async function Portada() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const demos = await Promise.all(
    slugsConocidos().map(async (slug) => ({ slug, espacio: await leerEspacio(slug) })),
  );

  return (
    <div className="pizarra min-h-dvh bg-[#0e0f11] px-5 py-14 text-[#f3efe6]">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#d4a03c]">
          Pulso Local AI
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2.1rem] leading-tight sm:text-5xl">
          El QR que convierte visitas en clientes que vuelven.
        </h1>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-white/60">
          No es una carta digital. Es un punto de captación y fidelización en cada mesa, ticket o
          mostrador: carta, menú del día, reservas, opiniones y contactos, todo medido.
        </p>

        <h2 className="mt-12 text-sm font-semibold text-white/70">Demostraciones</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {demos.map(({ slug, espacio }) => {
            if (!espacio) return null;
            const enlace = urlDeQr(base, slug, `${slug.slice(0, 3)}-mesa`, undefined);
            return (
              <div key={slug} className="rounded-[14px] border border-white/10 bg-[#17181b] p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="h-20 w-20 shrink-0 rounded-lg bg-white p-1"
                    dangerouslySetInnerHTML={{ __html: qrSvg(enlace, { margen: 1 }) }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] text-lg leading-tight">
                      {espacio.negocio.name}
                    </h3>
                    {espacio.ajustes.tagline ? (
                      <p className="mt-1 text-xs leading-snug text-white/55">{espacio.ajustes.tagline}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-white/40">
                      {espacio.platos.length} platos cargados
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={`/b/${slug}`} className="rounded-full bg-[#d4a03c] px-4 py-2 font-semibold text-[#17181b]">
                    Abrir
                  </Link>
                  <Link href={`/dashboard?negocio=${slug}`} className="rounded-full border border-white/15 px-4 py-2">
                    Panel
                  </Link>
                  <Link href={`/dashboard/qr?negocio=${slug}`} className="rounded-full border border-white/15 px-4 py-2">
                    Sus QR
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
          <p className="text-sm font-semibold text-amber-200">Antes de enviar nada a un cliente</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
            Hay platos, precios y horarios sin confirmar por los negocios, y faltan el WhatsApp y
            el enlace de Google Reviews de cada uno. Están marcados como muestra en la propia
            página. Confírmalo con el local antes de publicar.
          </p>
        </div>
      </div>
    </div>
  );
}

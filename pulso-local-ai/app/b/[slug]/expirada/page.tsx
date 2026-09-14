import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { leerEspacio } from "@/lib/datos";
import { estadoDemo } from "@/lib/trial";
import { TemaNegocio } from "@/components/tema";
import { EnlaceBoton } from "@/components/ui/boton";
import { enlaceWhatsapp } from "@/lib/whatsapp";

// ============================================================================
//  Demo caducada — /b/[slug]/expirada
// ----------------------------------------------------------------------------
//  Vive FUERA del grupo (vivo) a propósito: el layout de ese grupo redirige
//  aquí cuando la demo ha terminado, así que si esta página estuviera dentro,
//  se redirigiría a sí misma en bucle.
//
//  Tono: elegante y sin reproche. Quien llega aquí puede ser un cliente del
//  bar que escaneó un QR, no el dueño. No se le echa la culpa a nadie ni se
//  enseña un "contrata ya" agresivo; se explica qué pasó y se deja una puerta
//  abierta para el dueño.
//
//  Y lo importante: aquí NO se sirve carta, menú, precios, formularios ni
//  captación. Nada de contenido del negocio.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const espacio = await leerEspacio(slug);
  return {
    title: espacio ? `Demostración finalizada · ${espacio.negocio.name}` : "Demostración finalizada",
    robots: { index: false, follow: false },
  };
}

export default async function PaginaExpirada({ params }: Props) {
  const { slug } = await params;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();

  // Si la demo sigue viva, aquí no pinta nada: de vuelta al espacio.
  const demo = estadoDemo(espacio.negocio);
  if (demo.vivo) redirect(`/b/${slug}`);

  const { negocio, ajustes } = espacio;

  // El CTA va al WhatsApp de Pulso Local AI, no al del negocio: quien tiene
  // que decidir reactivar es el dueño, y el mensaje es comercial.
  const comercial = ajustes.reactivation_whatsapp
    ?? process.env.NEXT_PUBLIC_PULSO_WHATSAPP
    ?? null;

  const wasap = enlaceWhatsapp(
    comercial,
    "Pulso Local AI",
    { tipo: "evento", evento: `reactivar el espacio de ${negocio.name}` },
  );

  return (
    <>
      <TemaNegocio tema={ajustes.theme} />
      <main className="pizarra flex min-h-dvh items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg text-center animate-[var(--animate-subir)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--negocio-acento)]">
            Pulso Local AI
          </p>

          <h1 className="mt-4 font-[family-name:var(--font-display)] text-[1.7rem] leading-snug sm:text-4xl">
            La demostración digital de {negocio.name} ha finalizado.
          </h1>

          <p className="mx-auto mt-4 max-w-md text-[0.95rem] leading-relaxed text-[var(--negocio-tenue)]">
            Esta página era una demostración temporal: la carta, el menú del día y las reservas
            ya no están disponibles aquí.
          </p>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--negocio-tenue)]">
            Si buscabas el local, lo mejor es llamar o pasarte.
            {ajustes.phone ? (
              <>
                {" "}Su teléfono es{" "}
                <a href={`tel:${ajustes.phone}`} className="font-semibold text-[var(--negocio-texto)] underline underline-offset-4">
                  {ajustes.phone}
                </a>.
              </>
            ) : null}
          </p>

          {wasap ? (
            <div className="mt-8">
              <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal" tamano="lg" className="neon">
                Reactivar mi espacio
              </EnlaceBoton>
              <p className="mt-3 text-xs text-[var(--negocio-tenue)]">
                ¿Eres el dueño? Escríbenos y lo volvemos a poner en marcha con tus datos.
              </p>
            </div>
          ) : null}

          <p className="mt-10 text-[0.7rem] leading-relaxed text-[var(--negocio-tenue)]">
            Los datos cargados se conservan 30 días por si se reactiva. Después se borran.
          </p>
        </div>
      </main>
    </>
  );
}

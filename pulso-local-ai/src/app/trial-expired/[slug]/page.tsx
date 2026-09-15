import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { obtenerNegocioParaCaducidad } from "@/lib/negocio";
import { entornoPublico } from "@/lib/entorno";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const negocio = await obtenerNegocioParaCaducidad(slug).catch(() => null);
  return {
    title: negocio ? `La demostración de ${negocio.name} ha finalizado` : "Demostración finalizada",
    robots: { index: false, follow: false },
  };
}

/**
 * Página de demo finalizada.
 *
 * Aquí no se enseña NADA del contenido que estuvo activo: ni inmuebles, ni
 * teléfonos, ni formularios. Solo el nombre del negocio y cómo reactivarlo. Si
 * la demo caducó, caducó.
 */
export default async function DemoFinalizada({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const negocio = await obtenerNegocioParaCaducidad(slug);
  if (!negocio) notFound();

  const whatsappSaas = process.env.WHATSAPP_SAAS ?? "";
  const reactivar =
    negocio.reactivation_url ??
    (negocio.reactivation_phone || whatsappSaas
      ? `https://wa.me/${(negocio.reactivation_phone ?? whatsappSaas).replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hola, quiero reactivar el espacio de ${negocio.name} en PULSO LOCAL AI.`,
        )}`
      : null);

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16 text-center"
    >
      <div className="animar-entrada space-y-3">
        <p className="text-sm font-semibold tracking-widest text-[var(--acento)] uppercase">
          {entornoPublico.nombreProducto}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--marca)] sm:text-4xl">
          La demostración ha finalizado.
        </h1>
        <p className="text-base text-[var(--texto-suave)]">
          Este espacio digital de <strong className="text-[var(--texto)]">{negocio.name}</strong> ha terminado su
          periodo de demostración.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {reactivar ? (
          <Button asChild size="lg" ancho="completo">
            <a href={reactivar} target="_blank" rel="noopener noreferrer">
              Reactivar mi espacio
            </a>
          </Button>
        ) : null}
        <Button asChild variant="contorno" size="lg" ancho="completo">
          <Link href="/">Contactar con PULSO LOCAL AI</Link>
        </Button>
      </div>

      <p className="text-xs text-[var(--texto-suave)]">
        Los contenidos siguen guardados durante un tiempo limitado. Si reactivas el espacio, todo vuelve donde
        estaba.
      </p>
    </main>
  );
}

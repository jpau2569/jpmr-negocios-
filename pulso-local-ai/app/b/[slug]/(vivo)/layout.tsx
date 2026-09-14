import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { leerEspacio, slugsConocidos } from "@/lib/datos";
import { estadoDemo } from "@/lib/trial";
import { TemaNegocio } from "@/components/tema";
import { Cabecera } from "@/components/publico/cabecera";
import { Pie } from "@/components/publico/pie";

// ============================================================================
//  Layout del espacio público de un negocio
// ----------------------------------------------------------------------------
//  Aquí se hace el corte de la demo de 7 días, EN SERVIDOR. Si la demo ha
//  caducado, nadie llega al contenido: se redirige a /expirada antes de
//  renderizar nada. Y aunque alguien se saltara esto, RLS tampoco devolvería
//  los datos (business_is_live en sql/02_rls.sql). Dos cierres independientes.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateStaticParams() {
  return slugsConocidos().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const espacio = await leerEspacio(slug);
  if (!espacio) return { title: "Negocio no encontrado" };

  const { negocio, ajustes } = espacio;
  const descripcion = ajustes.tagline
    ?? `Carta, menú del día y reservas de ${negocio.name}.`;

  return {
    title: { absolute: `${negocio.name}${ajustes.tagline ? ` · ${ajustes.tagline}` : ""}` },
    description: descripcion,
    openGraph: {
      title: negocio.name,
      description: descripcion,
      type: "website",
      locale: "es_ES",
      ...(ajustes.cover_url ? { images: [{ url: ajustes.cover_url }] } : {}),
    },
    // Una demo no debe indexarse: sale en Google compitiendo con la web real
    // del negocio, que es lo último que quiere el cliente.
    robots: negocio.status === "active" ? undefined : { index: false, follow: false },
  };
}

export default async function LayoutNegocio({ params, children }: Props) {
  const { slug } = await params;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();

  const demo = estadoDemo(espacio.negocio);
  if (!demo.vivo) redirect(`/b/${slug}/expirada`);

  return (
    <>
      <TemaNegocio tema={espacio.ajustes.theme} />
      <a href="#contenido" className="salto-contenido">Saltar al contenido</a>
      <Cabecera espacio={espacio} />
      <main id="contenido" className="pizarra min-h-[60vh]">{children}</main>
      <Pie espacio={espacio} />
    </>
  );
}

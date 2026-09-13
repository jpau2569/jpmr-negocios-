import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { leerNegocioPublico, obtenerAjustesPublicos, obtenerNegocioParaCaducidad, obtenerNegocioPublico } from "@/lib/negocio";
import { variablesTema } from "@/lib/tema";
import { CabeceraNegocio } from "@/components/publico/cabecera-negocio";
import { PieNegocio } from "@/components/publico/pie-negocio";
import { AsistenteFlotante } from "@/components/publico/asistente-flotante";

export const revalidate = 60;

/**
 * Los errores dentro de `generateMetadata` no los recoge ningún `error.tsx`: se
 * llevan por delante la respuesta entera. Por eso nunca se deja escapar uno:
 * si falla la consulta, metadatos neutros y a seguir.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  const negocio = await obtenerNegocioPublico(slug).catch(() => null);
  if (!negocio) return { title: "Espacio no disponible", robots: { index: false } };

  return {
    title: { default: negocio.name, template: `%s · ${negocio.name}` },
    description: negocio.description ?? negocio.tagline ?? undefined,
    openGraph: {
      title: negocio.name,
      description: negocio.tagline ?? undefined,
      images: negocio.cover_url ? [negocio.cover_url] : undefined,
    },
    // Los espacios en demo no se indexan: son pruebas, no la web del negocio.
    robots: negocio.status === "trial" ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/**
 * Envoltorio de todo lo público de un negocio.
 *
 * Si `obtenerNegocioPublico` no devuelve nada puede ser por dos motivos muy
 * distintos: que el slug no exista (404) o que la demo haya caducado (página de
 * demostración finalizada). Distinguirlos importa: la segunda es una página
 * comercial, no un error.
 */
export default async function LayoutNegocio({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lectura = await leerNegocioPublico(slug);

  // Si la base de datos no responde, esto es lo que ve alguien que acaba de
  // escanear un cartel en la calle: un mensaje claro, no un 404 que le haría
  // pensar que el negocio ya no existe.
  if (lectura.estado === "error") {
    console.error(`[pulso-local-ai] no se ha podido leer el negocio "${slug}": ${lectura.motivo}`);
    return <PaginaNoDisponible />;
  }

  if (lectura.estado === "no_publicable") {
    const existe = await obtenerNegocioParaCaducidad(slug);
    if (existe) redirect(`/trial-expired/${slug}`);
    notFound();
  }

  const negocio = lectura.negocio;
  const ajustes = await obtenerAjustesPublicos(negocio.id);

  return (
    <div style={variablesTema(negocio.theme)} className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <CabeceraNegocio negocio={negocio} />
      <main id="contenido" className="pb-24">
        {children}
      </main>
      <PieNegocio negocio={negocio} ajustes={ajustes} />
      {ajustes?.ai_assistant_enabled ? (
        <AsistenteFlotante slug={negocio.slug} nombreAsistente={ajustes.ai_assistant_name} negocio={negocio.name} />
      ) : null}
    </div>
  );
}

/** Pantalla honesta cuando no se puede leer el contenido del negocio. */
function PaginaNoDisponible() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Esta página no carga ahora mismo</h1>
      <p className="text-[var(--texto-suave)]">
        Es un problema nuestro, no tuyo. Vuelve a intentarlo en un momento; si tienes prisa, llama directamente a
        la oficina.
      </p>
    </main>
  );
}

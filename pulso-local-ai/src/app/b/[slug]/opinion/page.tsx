import { notFound } from "next/navigation";
import { Rastreador } from "@/components/publico/rastreador";
import { FormularioOpinion } from "@/components/publico/formulario-opinion";
import { obtenerAjustesPublicos, obtenerNegocioPublico } from "@/lib/negocio";

export const revalidate = 60;
export const metadata = { title: "Tu opinión" };

export default async function PaginaOpinion({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();
  const ajustes = await obtenerAjustesPublicos(negocio.id);

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <Rastreador slug={slug} tipo="feedback_start" />
      <FormularioOpinion
        slug={slug}
        nombreNegocio={negocio.name}
        urlResenas={ajustes?.google_review_url ?? negocio.review_url}
        textoAlto={ajustes?.review_request_high}
        textoBajo={ajustes?.review_request_low}
      />
    </section>
  );
}

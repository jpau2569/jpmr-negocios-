import { notFound } from "next/navigation";
import { Rastreador } from "@/components/publico/rastreador";
import { FormularioBusqueda } from "@/components/publico/formulario-busqueda";
import { obtenerNegocioPublico } from "@/lib/negocio";
import { enlaceWhatsapp } from "@/lib/formato";

export const revalidate = 60;
export const metadata = { title: "Busco vivienda" };

export default async function PaginaBuscarVivienda({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <Rastreador slug={slug} tipo="buyer_request_start" />
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Cuéntanos qué buscas</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Muchas viviendas se venden antes de llegar a los portales. Si sabemos qué necesitas, te avisamos
          primero.
        </p>
      </header>

      <FormularioBusqueda
        slug={slug}
        nombreNegocio={negocio.name}
        whatsapp={enlaceWhatsapp(negocio.whatsapp_phone, `Hola, busco vivienda y escribo desde la web de ${negocio.name}.`)}
      />
    </section>
  );
}

import { notFound } from "next/navigation";
import { FormularioContacto } from "@/components/publico/formulario-contacto";
import { obtenerNegocioPublico } from "@/lib/negocio";
import { enlaceWhatsapp } from "@/lib/formato";
import type { TipoLead } from "@/types/dominio";

export const revalidate = 60;
export const metadata = { title: "Contacto" };

const TIPOS_VALIDOS: TipoLead[] = [
  "seller", "buyer", "tenant", "landlord", "investor",
  "community_administration", "tax_labor_legal_consultation", "general_consultation",
];

export default async function PaginaContacto({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tipo?: string; inmueble?: string }>;
}) {
  const { slug } = await params;
  const { tipo, inmueble } = await searchParams;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  const tipoInicial = (TIPOS_VALIDOS as string[]).includes(tipo ?? "")
    ? (tipo as TipoLead)
    : "general_consultation";

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <FormularioContacto
        slug={slug}
        nombreNegocio={negocio.name}
        tipoInicial={tipoInicial}
        propertyId={inmueble}
        whatsapp={enlaceWhatsapp(negocio.whatsapp_phone, `Hola, escribo desde la página de ${negocio.name}.`)}
      />
    </section>
  );
}

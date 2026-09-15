import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { Rastreador } from "@/components/publico/rastreador";
import { FormularioValoracion } from "@/components/publico/formulario-valoracion";
import { obtenerAjustesPublicos, obtenerNegocioPublico } from "@/lib/negocio";
import { enlaceWhatsapp } from "@/lib/formato";

export const revalidate = 60;
export const metadata = { title: "Valoración de tu inmueble" };

export default async function PaginaValoracion({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();
  const ajustes = await obtenerAjustesPublicos(negocio.id);

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <Rastreador slug={slug} tipo="valuation_start" />

      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">¿Cuánto vale tu inmueble?</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Responde seis preguntas rápidas. Lo revisa una persona de {negocio.name} y te contacta con un rango
          explicado.
        </p>
      </header>

      {ajustes?.valuation_mode === "personalizada" ? (
        <Aviso tono="info" className="mb-6">
          No damos un número automático. Cada inmueble se revisa a mano antes de decirte nada.
        </Aviso>
      ) : null}

      <FormularioValoracion
        slug={slug}
        nombreNegocio={negocio.name}
        notaValoracion={ajustes?.valuation_manual_note}
        whatsapp={enlaceWhatsapp(negocio.whatsapp_phone, `Hola, quiero valorar un inmueble con ${negocio.name}.`)}
      />
    </section>
  );
}

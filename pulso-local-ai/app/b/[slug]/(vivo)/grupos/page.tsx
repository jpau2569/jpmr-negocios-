import { notFound } from "next/navigation";
import { leerEspacio, hayBackend, moduloActivo } from "@/lib/datos";
import { FormularioGrupo } from "@/components/publico/formulario-grupo";
import { IniciarAnalitica } from "@/components/publico/rastreador";
import { Aviso } from "@/components/ui/basicos";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qr?: string }>;
}

export default async function PaginaGrupos({ params, searchParams }: Props) {
  const { slug } = await params;
  const { qr } = await searchParams;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  // Las rutas son comunes a todos los sectores: si este negocio no tiene
  // el módulo encendido, esta página no existe para él.
  if (!moduloActivo(espacio, "groups")) notFound();

  const { negocio, ajustes } = espacio;

  return (
    <div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null} />
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          ¿Celebras algo? Cuéntanos tu plan.
        </h1>
        <p className="mt-1.5 text-sm text-[var(--negocio-tenue)]">
          Comuniones, cumpleaños, comidas de empresa o cenas de amigos. Te preparamos una propuesta.
        </p>

        <div className="mt-6">
          <FormularioGrupo slug={slug} negocio={negocio.name} whatsapp={ajustes.whatsapp} />
        </div>

        {!hayBackend() ? (
          <Aviso tono="error" className="mt-5">
            <strong>Demostración.</strong> No hay base de datos conectada: lo que envíes no se
            guarda ni lo lee nadie.
          </Aviso>
        ) : null}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { leerEspacio, hayBackend } from "@/lib/datos";
import { FormularioOpinion } from "@/components/publico/formulario-opinion";
import { IniciarAnalitica } from "@/components/publico/rastreador";
import { Aviso } from "@/components/ui/basicos";
// ============================================================================
//  Opinión — /b/[slug]/opinion
// ----------------------------------------------------------------------------
//  Destino del QR del ticket: el mejor momento para preguntar es justo al
//  pagar, cuando la experiencia está fresca.
// ============================================================================
export const revalidate = 60;
export default async function PaginaOpinion({ params, searchParams }) {
    const { slug } = await params;
    const { qr } = await searchParams;
    const espacio = await leerEspacio(slug);
    if (!espacio)
        notFound();
    const { negocio, ajustes } = espacio;
    return (<div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null}/>
      <div className="mx-auto w-full max-w-2xl">
        <FormularioOpinion slug={slug} negocio={negocio.name} reviewUrl={ajustes.review_url}/>

        {!ajustes.review_url ? (<Aviso className="mt-5">
            El negocio todavía no ha dado su enlace oficial de Google, así que aquí no aparece el
            botón de reseña. No se inventa ninguno.
          </Aviso>) : null}

        {!hayBackend() ? (<Aviso tono="error" className="mt-3">
            <strong>Demostración.</strong> Tu opinión no se guarda en ningún sitio.
          </Aviso>) : null}
      </div>
    </div>);
}

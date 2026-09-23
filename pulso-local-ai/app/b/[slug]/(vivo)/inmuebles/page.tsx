import { notFound } from "next/navigation";
import { leerEspacio, moduloActivo } from "@/lib/datos";
import { Vacio, SinConfirmar } from "@/components/ui/basicos";
import { TarjetaInmueble } from "@/components/publico/inmueble";
import { IniciarAnalitica, Vista } from "@/components/publico/rastreador";

// ============================================================================
//  Cartera — /b/[slug]/inmuebles
// ----------------------------------------------------------------------------
//  Lo que ve alguien que escanea el QR del escaparate a las once de la noche
//  con la oficina cerrada. Todo en una página, sin filtros que exijan pensar:
//  a esa hora y en la calle, nadie va a rellenar un formulario de búsqueda.
//
//  Los vendidos NO se esconden. Van al final y tachados, porque son prueba
//  social: "esta agencia mueve pisos" vende más que un listado corto.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qr?: string }>;
}

export default async function PaginaInmuebles({ params, searchParams }: Props) {
  const { slug } = await params;
  const { qr } = await searchParams;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  // Las rutas son comunes a todos los sectores: si este negocio no tiene
  // el módulo encendido, esta página no existe para él.
  if (!moduloActivo(espacio, "properties")) notFound();

  const inmuebles = espacio.inmuebles;
  const disponibles = inmuebles.filter((i) => i.deal_state === "disponible");
  const cerrados = inmuebles.filter((i) => i.deal_state !== "disponible");
  const enVenta = disponibles.filter((i) => i.operation === "venta");
  const enAlquiler = disponibles.filter((i) => i.operation === "alquiler");

  return (
    <div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null} />
      <Vista evento="property_list_view" />

      <div className="mx-auto w-full max-w-5xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          Nuestra cartera
        </h1>
        <p className="mt-1.5 text-sm text-[var(--negocio-tenue)]">
          {disponibles.length === 0
            ? "Cartera pendiente de cargar."
            : `${disponibles.length} ${disponibles.length === 1 ? "inmueble disponible" : "inmuebles disponibles"}`}
          {enAlquiler.length > 0 && enVenta.length > 0
            ? ` · ${enVenta.length} en venta, ${enAlquiler.length} en alquiler`
            : ""}
        </p>

        {inmuebles.length === 0 ? (
          <Vacio>
            La cartera todavía no está cargada. Si buscas algo concreto,
            escríbenos y te decimos qué tenemos ahora mismo.
          </Vacio>
        ) : (
          <>
            {inmuebles.some((i) => i.is_demo) ? (
              <SinConfirmar
                className="mt-5"
                texto="Hay fichas marcadas como muestra: la agencia las confirma antes de publicar. Pregunta por cualquier dato concreto antes de decidir nada."
              />
            ) : null}

            {disponibles.length > 0 ? (
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {disponibles.map((i) => (
                  <li key={i.id}>
                    <TarjetaInmueble inmueble={i} slug={slug} />
                  </li>
                ))}
              </ul>
            ) : null}

            {cerrados.length > 0 ? (
              <section className="mt-12">
                <h2 className="font-[family-name:var(--font-display)] text-2xl">
                  Vendidos y alquilados
                </h2>
                <p className="mt-1 text-sm text-[var(--negocio-tenue)]">
                  Se quedan aquí para que veas lo que movemos. Si te gustaba
                  alguno, dinos qué buscabas: suele entrar algo parecido.
                </p>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {cerrados.map((i) => (
                    <li key={i.id}>
                      <TarjetaInmueble inmueble={i} slug={slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="mt-10 rounded-xl border border-[var(--negocio-borde)] px-4 py-3 text-xs leading-relaxed text-[var(--negocio-tenue)]">
              Los datos de superficie, distribución y gastos son orientativos y
              proceden de la información facilitada por la propiedad. Antes de
              firmar nada, se comprueban con la nota simple y la documentación
              del inmueble.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { leerEspacio, inmueblePorSlug, moduloActivo } from "@/lib/datos";
import { Tarjeta, Aviso, SinConfirmar } from "@/components/ui/basicos";
import { EnlaceBoton } from "@/components/ui/boton";
import { EtiquetaEnergia } from "@/components/publico/energia";
import { FormularioVisita } from "@/components/publico/formulario-visita";
import { EstadoOperacion, precioInmueble } from "@/components/publico/inmueble";
import { IniciarAnalitica, Vista } from "@/components/publico/rastreador";
import { enlaceWhatsapp, enlaceMapa } from "@/lib/whatsapp";
import { precioPorM2, TIPOS_INMUEBLE_ES, type Inmueble } from "@/types/negocio";

// ============================================================================
//  Ficha de un inmueble — /b/[slug]/inmueble/[inmueble]
// ----------------------------------------------------------------------------
//  Esta es la página del QR del escaparate y la del cartel del balcón: la abre
//  alguien de pie en la calle, de noche, con la agencia cerrada. Por eso el
//  orden es fotos → precio → lo esencial → pedir visita, y el formulario está
//  en la misma página. Mandarle a otra pantalla es perderlo.
//
//  La dirección exacta solo se enseña si la agencia lo ha marcado. Publicar
//  el portal de un piso habitado sin permiso no es un descuido menor.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string; inmueble: string }>;
  searchParams: Promise<{ qr?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, inmueble } = await params;
  const espacio = await leerEspacio(slug);
  const ficha = espacio ? inmueblePorSlug(espacio, inmueble) : null;
  if (!espacio || !ficha) return { title: "Inmueble no encontrado" };

  const portada = ficha.fotos[0];
  return {
    title: { absolute: `${ficha.title} · ${espacio.negocio.name}` },
    description: ficha.description ?? `${TIPOS_INMUEBLE_ES[ficha.kind]} en ${ficha.municipality ?? ""}.`,
    openGraph: {
      title: ficha.title,
      description: precioInmueble(ficha),
      type: "website",
      locale: "es_ES",
      ...(portada ? { images: [{ url: portada.url }] } : {}),
    },
  };
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border-b border-[var(--negocio-borde)] py-2.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-[var(--negocio-tenue)]">{etiqueta}</dt>
      <dd className="mt-0.5">{valor}</dd>
    </div>
  );
}

/** Solo lo que se sabe. Una tabla llena de guiones da sensación de chapuza. */
function datosDe(i: Inmueble): { etiqueta: string; valor: string }[] {
  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Tipo", valor: TIPOS_INMUEBLE_ES[i.kind] },
    { etiqueta: "Operación", valor: i.operation === "venta" ? "Venta" : "Alquiler" },
  ];
  if (i.surface_built_m2 !== null) filas.push({ etiqueta: "Superficie construida", valor: `${i.surface_built_m2} m²` });
  if (i.surface_useful_m2 !== null) filas.push({ etiqueta: "Superficie útil", valor: `${i.surface_useful_m2} m²` });
  if (i.rooms !== null) filas.push({ etiqueta: "Habitaciones", valor: String(i.rooms) });
  if (i.bathrooms !== null) filas.push({ etiqueta: "Baños", valor: String(i.bathrooms) });
  if (i.floor_label) filas.push({ etiqueta: "Planta", valor: i.floor_label });
  if (i.has_lift !== null) filas.push({ etiqueta: "Ascensor", valor: i.has_lift ? "Sí" : "No" });
  if (i.year_built !== null) filas.push({ etiqueta: "Año de construcción", valor: String(i.year_built) });
  if (i.condition_note) filas.push({ etiqueta: "Estado", valor: i.condition_note });
  if (i.zone) filas.push({ etiqueta: "Zona", valor: i.zone });
  if (i.municipality) filas.push({ etiqueta: "Municipio", valor: i.municipality });
  filas.push({ etiqueta: "Referencia", valor: i.reference });
  return filas;
}

export default async function PaginaInmueble({ params, searchParams }: Props) {
  const { slug, inmueble } = await params;
  const { qr } = await searchParams;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  // Las rutas son comunes a todos los sectores: si este negocio no tiene
  // el módulo encendido, esta página no existe para él.
  if (!moduloActivo(espacio, "properties")) notFound();

  const ficha = inmueblePorSlug(espacio, inmueble);
  if (!ficha) notFound();

  const { negocio, ajustes } = espacio;
  const porM2 = precioPorM2(ficha);
  const cerrado = ficha.deal_state === "vendido" || ficha.deal_state === "alquilado";
  const asunto = `${ficha.title} (ref. ${ficha.reference})`;
  const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "inmueble", detalle: asunto });
  const mapa = ficha.street_is_public
    ? enlaceMapa(ficha.street, ficha.lat, ficha.lng)
    : enlaceMapa(ficha.municipality, null, null);

  return (
    <div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null} />
      <Vista evento="property_view" subjectId={ficha.id} />

      <div className="mx-auto w-full max-w-4xl">
        <Link href={`/b/${slug}/inmuebles`} className="text-sm text-[var(--negocio-tenue)] underline">
          ← Volver a la cartera
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
            {ficha.title}
          </h1>
          <EstadoOperacion inmueble={ficha} />
        </div>

        <p className="mt-3 text-3xl font-semibold">{precioInmueble(ficha)}</p>
        {porM2 !== null ? (
          <p className="text-sm text-[var(--negocio-tenue)]">
            {porM2.toLocaleString("es-ES")} €/m² construido
          </p>
        ) : null}

        {ficha.is_demo ? (
          <SinConfirmar
            className="mt-5"
            texto="Ficha marcada como muestra: la agencia todavía no ha confirmado estos datos. Pregunta por cualquiera de ellos antes de decidir nada."
          />
        ) : null}

        {cerrado ? (
          <Aviso className="mt-5">
            Este inmueble ya está {ficha.deal_state === "vendido" ? "vendido" : "alquilado"}.
            Lo dejamos publicado para que veas lo que movemos. Si buscabas algo así,
            dínoslo y te avisamos cuando entre algo parecido.
          </Aviso>
        ) : null}

        {ficha.fotos.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ficha.fotos.map((f, indice) => (
              // Sin next/image: las fotos vienen del hosting de la agencia y
              // una URL remota rota no debe tumbar el render de la ficha.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.id}
                src={f.url}
                alt={f.alt ?? `${ficha.title} — foto ${indice + 1}`}
                loading={indice === 0 ? "eager" : "lazy"}
                className={`w-full rounded-xl border border-[var(--negocio-borde)] object-cover ${
                  indice === 0 ? "sm:col-span-2 aspect-[16/10]" : "aspect-[4/3]"
                }`}
              />
            ))}
          </div>
        ) : null}

        {ficha.description ? (
          <div className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">La vivienda</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{ficha.description}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Datos</h2>
            <Tarjeta className="mt-3 px-5 py-1">
              <dl>
                {datosDe(ficha).map((d) => (
                  <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
                ))}
              </dl>
            </Tarjeta>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              Eficiencia energética
            </h2>
            <Tarjeta className="mt-3 p-5">
              <EtiquetaEnergia
                letra={ficha.energy_rating}
                estado={ficha.energy_status}
                conTexto
              />
              <p className="mt-3 text-xs leading-relaxed text-[var(--negocio-tenue)]">
                Su exhibición en los anuncios es obligatoria (Real Decreto 390/2021).
                Si aquí no aparece la letra, es que todavía no está cargada: pídenosla
                y te la pasamos.
              </p>
            </Tarjeta>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {wasap ? (
                <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal">
                  Preguntar por WhatsApp
                </EnlaceBoton>
              ) : null}
              {mapa ? (
                <EnlaceBoton href={mapa} target="_blank" rel="noopener" variante="contorno">
                  Ver la zona
                </EnlaceBoton>
              ) : null}
            </div>
            {!ficha.street_is_public ? (
              <p className="mt-2 text-xs text-[var(--negocio-tenue)]">
                La dirección exacta se facilita al concertar la visita.
              </p>
            ) : null}
          </section>
        </div>

        {!cerrado ? (
          <section className="mt-10">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Pedir visita</h2>
            <p className="mt-1 text-sm text-[var(--negocio-tenue)]">
              Déjanos tu teléfono y te llamamos para cuadrarla. También fuera de horario:
              lo vemos a primera hora.
            </p>
            <div className="mt-4">
              <FormularioVisita
                slug={slug}
                negocio={negocio.name}
                telefono={ajustes.phone}
                whatsapp={ajustes.whatsapp}
                referencia={ficha.reference}
                tituloInmueble={ficha.title}
              />
            </div>
          </section>
        ) : null}

        <p className="mt-10 rounded-xl border border-[var(--negocio-borde)] px-4 py-3 text-xs leading-relaxed text-[var(--negocio-tenue)]">
          Los datos de superficie, distribución, cargas y gastos son orientativos y proceden
          de la información facilitada por la propiedad. Se comprueban con la nota simple y
          la documentación del inmueble antes de firmar nada. Esta ficha no constituye
          oferta contractual.
        </p>
      </div>
    </div>
  );
}

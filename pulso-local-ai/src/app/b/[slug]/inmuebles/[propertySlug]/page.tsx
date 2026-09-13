import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Aviso, DistintivoDemo } from "@/components/ui/aviso";
import { Icono } from "@/components/ui/icono";
import { Rastreador, EnlaceMedido } from "@/components/publico/rastreador";
import { GaleriaInmueble } from "@/components/publico/galeria-inmueble";
import { CtaFijoMovil } from "@/components/publico/cta-fijo";
import { FormularioVisita } from "@/components/publico/formulario-visita";
import { TarjetaInmueble } from "@/components/publico/tarjeta-inmueble";
import {
  inmueblesSimilares, listarCaracteristicas, listarMedios, obtenerInmueble, obtenerNegocioPublico,
} from "@/lib/negocio";
import { enlaceLlamada, enlaceWhatsapp, metros, precioInmueble, recortar } from "@/lib/formato";
import { ETIQUETA_ESTADO_INMUEBLE, ETIQUETA_ETIQUETA_INMUEBLE, ETIQUETA_OPERACION, ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; propertySlug: string }>;
}): Promise<Metadata> {
  const { slug, propertySlug } = await params;

  // Igual que en el layout: un fallo aquí no lo recoge ningún `error.tsx`.
  const negocio = await obtenerNegocioPublico(slug).catch(() => null);
  if (!negocio) return { title: "Inmueble no disponible" };
  const inmueble = await obtenerInmueble(negocio.id, propertySlug).catch(() => null);
  if (!inmueble) return { title: "Inmueble no disponible" };

  return {
    title: inmueble.title,
    description: recortar(inmueble.short_description ?? inmueble.description, 155),
  };
}

export default async function FichaInmueble({
  params,
}: {
  params: Promise<{ slug: string; propertySlug: string }>;
}) {
  const { slug, propertySlug } = await params;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  const inmueble = await obtenerInmueble(negocio.id, propertySlug);
  if (!inmueble) notFound();

  const [medios, caracteristicas, similares] = await Promise.all([
    listarMedios([inmueble.id]),
    listarCaracteristicas(inmueble.id),
    inmueblesSimilares(inmueble),
  ]);

  const fotos = medios.filter((m) => m.kind === "foto");
  const tour = medios.find((m) => m.kind === "tour_virtual");
  const video = medios.find((m) => m.kind === "video");
  const planos = medios.filter((m) => m.kind === "plano");
  const documentos = medios.filter((m) => m.kind === "documento");

  const mediosSimilares = await listarMedios(similares.map((p) => p.id));
  const portadasSimilares = new Map(mediosSimilares.filter((m) => m.is_cover).map((m) => [m.property_id, m]));

  const mensajeWa =
    `Hola, me interesa el inmueble "${inmueble.title}"` +
    (inmueble.reference_code ? ` (ref. ${inmueble.reference_code})` : "") +
    ". ¿Podemos hablar?";
  const whatsapp = enlaceWhatsapp(negocio.whatsapp_phone, mensajeWa);
  const llamada = enlaceLlamada(negocio.phone);
  const noDisponible = inmueble.status === "vendido" || inmueble.status === "alquilado";

  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Operación", valor: ETIQUETA_OPERACION[inmueble.operation_type] },
    { etiqueta: "Tipo", valor: ETIQUETA_TIPO_INMUEBLE[inmueble.property_type] },
    ...(inmueble.bedrooms !== null ? [{ etiqueta: "Habitaciones", valor: String(inmueble.bedrooms) }] : []),
    ...(inmueble.bathrooms !== null ? [{ etiqueta: "Baños", valor: String(inmueble.bathrooms) }] : []),
    ...(inmueble.built_area_m2 ? [{ etiqueta: "Construidos", valor: metros(inmueble.built_area_m2) }] : []),
    ...(inmueble.usable_area_m2 ? [{ etiqueta: "Útiles", valor: metros(inmueble.usable_area_m2) }] : []),
    ...(inmueble.plot_area_m2 ? [{ etiqueta: "Parcela", valor: metros(inmueble.plot_area_m2) }] : []),
    ...(inmueble.floor ? [{ etiqueta: "Planta", valor: inmueble.floor }] : []),
    ...(inmueble.year_built ? [{ etiqueta: "Año", valor: String(inmueble.year_built) }] : []),
    ...(inmueble.has_elevator !== null ? [{ etiqueta: "Ascensor", valor: inmueble.has_elevator ? "Sí" : "No" }] : []),
    ...(inmueble.has_terrace !== null ? [{ etiqueta: "Terraza", valor: inmueble.has_terrace ? "Sí" : "No" }] : []),
    ...(inmueble.has_garage !== null ? [{ etiqueta: "Garaje", valor: inmueble.has_garage ? "Sí" : "No" }] : []),
    ...(inmueble.energy_rating
      ? [
          {
            etiqueta: "Eficiencia energética",
            valor:
              inmueble.energy_rating === "en_tramite"
                ? "En trámite"
                : inmueble.energy_rating === "exento"
                  ? "Exento"
                  : inmueble.energy_rating,
          },
        ]
      : []),
  ];

  const zona = [inmueble.municipality, inmueble.neighborhood].filter(Boolean).join(" · ");
  const mapa = zona
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${zona}, España`)}&output=embed`
    : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:pb-8">
      <Rastreador slug={slug} tipo="property_view" propertyId={inmueble.id} />

      <nav className="mb-4 text-sm text-[var(--texto-suave)]">
        <Link href={`/b/${slug}/inmuebles`} className="underline underline-offset-4">
          ← Volver a los inmuebles
        </Link>
      </nav>

      <GaleriaInmueble fotos={fotos} titulo={inmueble.title} slug={slug} propertyId={inmueble.id} />

      <header className="mt-5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tono="marca">{ETIQUETA_OPERACION[inmueble.operation_type]}</Badge>
          {noDisponible || inmueble.status === "reservado" ? (
            <Badge tono="aviso">{ETIQUETA_ESTADO_INMUEBLE[inmueble.status]}</Badge>
          ) : null}
          {inmueble.tags.map((tag) => (
            <Badge key={tag} tono="contorno">
              {ETIQUETA_ETIQUETA_INMUEBLE[tag] ?? tag}
            </Badge>
          ))}
          {inmueble.reference_code ? <Badge tono="neutro">Ref. {inmueble.reference_code}</Badge> : null}
        </div>

        <h1 className="text-2xl font-bold tracking-tight">{inmueble.title}</h1>
        <p className="text-2xl font-bold text-[var(--marca)]">{precioInmueble(inmueble)}</p>
        <p className="text-sm text-[var(--texto-suave)]">
          {inmueble.public_address ? `${inmueble.public_address} · ` : ""}
          {zona || "Zona a consultar"}
        </p>
        {inmueble.is_demo_data ? <DistintivoDemo /> : null}
      </header>

      <div className="mt-5 hidden gap-2 sm:flex">
        <Button asChild size="lg">
          <Link href={`#solicitar-visita`}>Solicitar visita</Link>
        </Button>
        {whatsapp ? (
          <Button asChild size="lg" variant="acento">
            <EnlaceMedido slug={slug} tipo="whatsapp_click" href={whatsapp} propertyId={inmueble.id} externo>
              Preguntar por WhatsApp
            </EnlaceMedido>
          </Button>
        ) : null}
        {llamada ? (
          <Button asChild size="lg" variant="contorno">
            <EnlaceMedido slug={slug} tipo="call_click" href={llamada} propertyId={inmueble.id}>
              Llamar
            </EnlaceMedido>
          </Button>
        ) : null}
      </div>

      {inmueble.description ? (
        <section className="mt-7">
          <h2 className="text-lg font-bold tracking-tight">Descripción</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--texto-suave)]">
            {inmueble.description}
          </p>
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="text-lg font-bold tracking-tight">Datos principales</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {datos.map((dato) => (
            <div key={dato.etiqueta} className="rounded-[var(--radio)] bg-[var(--superficie)] p-3">
              <dt className="text-xs text-[var(--texto-suave)]">{dato.etiqueta}</dt>
              <dd className="text-sm font-semibold">{dato.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      {caracteristicas.length ? (
        <section className="mt-7">
          <h2 className="text-lg font-bold tracking-tight">Características</h2>
          <ul className="mt-3 space-y-2">
            {caracteristicas.map((caracteristica) => (
              <li key={caracteristica.id} className="flex items-start gap-2 text-sm">
                <Icono nombre="ok" className="mt-0.5 size-4 shrink-0 text-[var(--exito)]" />
                <span>
                  <strong>{caracteristica.label}</strong>
                  {caracteristica.value ? `: ${caracteristica.value}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tour || video || planos.length || documentos.length ? (
        <section className="mt-7">
          <h2 className="text-lg font-bold tracking-tight">Material adicional</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tour ? (
              <Button asChild variant="contorno">
                <EnlaceMedido slug={slug} tipo="property_tour_click" href={tour.url} propertyId={inmueble.id} externo>
                  Tour virtual
                </EnlaceMedido>
              </Button>
            ) : null}
            {video ? (
              <Button asChild variant="contorno">
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  Vídeo
                </a>
              </Button>
            ) : null}
            {planos.map((plano) => (
              <Button key={plano.id} asChild variant="contorno">
                <a href={plano.url} target="_blank" rel="noopener noreferrer">
                  Plano
                </a>
              </Button>
            ))}
            {documentos.map((documento) => (
              <Button key={documento.id} asChild variant="contorno">
                <a href={documento.url} target="_blank" rel="noopener noreferrer">
                  {documento.alt_text ?? "Documentación"}
                </a>
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {mapa ? (
        <section className="mt-7">
          <h2 className="text-lg font-bold tracking-tight">Ubicación aproximada</h2>
          <p className="mt-1 text-xs text-[var(--texto-suave)]">
            Se muestra la zona, no la dirección exacta. La dirección concreta se facilita al concertar la visita.
          </p>
          <div className="mt-3 overflow-hidden rounded-[var(--radio)] border border-[var(--borde)]">
            <iframe
              src={mapa}
              title={`Mapa de la zona de ${zona}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-56 w-full border-0"
            />
          </div>
        </section>
      ) : null}

      <Aviso tono="info" className="mt-7">
        {inmueble.conditions_note ?? "La información puede estar sujeta a cambios; consulta disponibilidad y condiciones."}
      </Aviso>

      <section id="solicitar-visita" className="mt-8 scroll-mt-6 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-lg font-bold tracking-tight">Me interesa este inmueble</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--texto-suave)]">
          Déjanos tus datos y te confirmamos una visita, una videollamada o una llamada, como prefieras.
        </p>
        <FormularioVisita slug={slug} propertyId={inmueble.id} tituloInmueble={inmueble.title} whatsapp={whatsapp} />
      </section>

      <section className="mt-8 rounded-[var(--radio)] bg-[var(--superficie-2)] p-5">
        <h2 className="text-base font-bold">¿No es exactamente lo que buscas?</h2>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Si este inmueble no encaja, cuéntanos qué buscas y te avisamos si aparece algo similar.
        </p>
        <Button asChild variant="contorno" className="mt-3">
          <Link href={`/b/${slug}/buscar-vivienda`}>Contarles qué busco</Link>
        </Button>
      </section>

      {similares.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">Inmuebles parecidos</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {similares.map((similar) => (
              <TarjetaInmueble
                key={similar.id}
                inmueble={similar}
                portada={portadasSimilares.get(similar.id)}
                slugNegocio={slug}
              />
            ))}
          </div>
        </section>
      ) : null}

      <CtaFijoMovil
        slug={slug}
        propertyId={inmueble.id}
        whatsapp={whatsapp}
        llamada={llamada}
        hrefVisita="#solicitar-visita"
      />
    </article>
  );
}

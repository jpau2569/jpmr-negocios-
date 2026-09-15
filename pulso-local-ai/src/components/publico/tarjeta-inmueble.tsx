import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icono } from "@/components/ui/icono";
import { DistintivoDemo } from "@/components/ui/aviso";
import { ETIQUETA_ESTADO_INMUEBLE, ETIQUETA_ETIQUETA_INMUEBLE, ETIQUETA_OPERACION, ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";
import { metros, precioInmueble } from "@/lib/formato";
import type { InmueblePublico, MedioPublico } from "@/types/dominio";

/**
 * Tarjeta del catálogo. La foto manda: es lo que decide si alguien entra o pasa
 * de largo, así que ocupa la mitad de la tarjeta incluso en móvil.
 */
export function TarjetaInmueble({
  inmueble,
  portada,
  slugNegocio,
}: {
  inmueble: InmueblePublico;
  portada?: MedioPublico;
  slugNegocio: string;
}) {
  const noDisponible = inmueble.status === "vendido" || inmueble.status === "alquilado";

  return (
    <article className="group overflow-hidden rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] transition-shadow hover:shadow-md">
      <Link href={`/b/${slugNegocio}/inmuebles/${inmueble.slug}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--superficie-2)]">
          {portada ? (
            <Image
              src={portada.url}
              alt={portada.alt_text ?? inmueble.title}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[var(--texto-suave)]">
              <Icono nombre="camara" className="size-8" />
            </span>
          )}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge tono="marca">{ETIQUETA_OPERACION[inmueble.operation_type]}</Badge>
            {noDisponible ? <Badge tono="neutro">{ETIQUETA_ESTADO_INMUEBLE[inmueble.status]}</Badge> : null}
            {inmueble.status === "reservado" ? <Badge tono="aviso">Reservado</Badge> : null}
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-bold text-[var(--marca)]">{precioInmueble(inmueble)}</p>
          <span className="text-xs text-[var(--texto-suave)]">{ETIQUETA_TIPO_INMUEBLE[inmueble.property_type]}</span>
        </div>

        <h3 className="text-sm leading-snug font-semibold">
          <Link href={`/b/${slugNegocio}/inmuebles/${inmueble.slug}`} className="hover:underline">
            {inmueble.title}
          </Link>
        </h3>

        <p className="text-xs text-[var(--texto-suave)]">
          {[inmueble.municipality, inmueble.neighborhood].filter(Boolean).join(" · ") || "Zona a consultar"}
        </p>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--texto-suave)]">
          {inmueble.bedrooms ? <li>{inmueble.bedrooms} hab.</li> : null}
          {inmueble.bathrooms ? <li>{inmueble.bathrooms} baños</li> : null}
          {inmueble.built_area_m2 ? <li>{metros(inmueble.built_area_m2)}</li> : null}
          {inmueble.has_elevator ? <li>Ascensor</li> : null}
          {inmueble.has_terrace ? <li>Terraza</li> : null}
          {inmueble.has_garage ? <li>Garaje</li> : null}
        </ul>

        {inmueble.tags.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {inmueble.tags.map((tag) => (
              <Badge key={tag} tono="contorno">
                {ETIQUETA_ETIQUETA_INMUEBLE[tag] ?? tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {inmueble.is_demo_data ? <DistintivoDemo className="mt-1" texto="Datos de demostración" /> : null}

        <Link
          href={`/b/${slugNegocio}/inmuebles/${inmueble.slug}`}
          className="mt-2 flex min-h-11 items-center justify-center rounded-[var(--radio)] bg-[var(--superficie-2)] text-sm font-semibold hover:bg-[var(--borde)]"
        >
          Ver inmueble
        </Link>
      </div>
    </article>
  );
}

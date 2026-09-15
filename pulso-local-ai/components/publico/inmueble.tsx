import Link from "next/link";
import { euros } from "@/lib/utils";
import {
  ESTADO_OPERACION_ES, TIPOS_INMUEBLE_ES, precioPorM2, type Inmueble,
} from "@/types/negocio";
import { EtiquetaEnergia } from "./energia";

// ============================================================================
//  Tarjeta de inmueble (la del listado)
// ----------------------------------------------------------------------------
//  Pensada para leerse de un vistazo en la calle, con el móvil en la mano y
//  posiblemente de noche delante de un escaparate: precio grande, lo esencial
//  en una línea, y nada de adornos que compitan con el dato.
// ============================================================================

/** "3 hab · 2 baños · 90 m²" — solo lo que se sabe, sin huecos ni guiones. */
export function resumenInmueble(i: Inmueble): string {
  const trozos: string[] = [];
  if (i.rooms !== null) trozos.push(`${i.rooms} hab`);
  if (i.bathrooms !== null) trozos.push(`${i.bathrooms} ${i.bathrooms === 1 ? "baño" : "baños"}`);
  if (i.surface_built_m2 !== null) trozos.push(`${i.surface_built_m2} m²`);
  if (i.floor_label) trozos.push(i.floor_label);
  return trozos.join(" · ");
}

/** El precio, o "Consultar". Nunca un cero ni un guion. */
export function precioInmueble(i: Inmueble): string {
  if (i.price_cents === null) return "Consultar";
  const importe = euros(i.price_cents);
  return i.operation === "alquiler" ? `${importe}/mes` : importe;
}

export function EstadoOperacion({ inmueble }: { inmueble: Inmueble }) {
  if (inmueble.deal_state === "disponible") return null;
  return (
    <span className="rounded-full bg-[var(--negocio-acento)] px-2.5 py-0.5 text-xs font-semibold text-[var(--negocio-sobre-acento)]">
      {ESTADO_OPERACION_ES[inmueble.deal_state]}
    </span>
  );
}

export function TarjetaInmueble({ inmueble, slug }: { inmueble: Inmueble; slug: string }) {
  const portada = inmueble.fotos[0];
  const resumen = resumenInmueble(inmueble);
  const porM2 = precioPorM2(inmueble);
  const cerrado = inmueble.deal_state === "vendido" || inmueble.deal_state === "alquilado";

  return (
    <Link
      href={`/b/${slug}/inmueble/${inmueble.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--negocio-borde)] bg-[var(--negocio-superficie)] transition hover:border-[var(--negocio-acento)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--negocio-fondo)]">
        {portada ? (
          // Sin next/image a propósito: las fotos vienen del hosting de la
          // agencia, que cambia, y una URL remota rota con next/image tumba
          // el render entero. Aquí como mucho queda un hueco.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portada.url}
            alt={portada.alt ?? inmueble.title}
            loading="lazy"
            className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${cerrado ? "opacity-55" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--negocio-tenue)]">
            Sin foto todavía
          </div>
        )}
        {inmueble.deal_state !== "disponible" ? (
          <div className="absolute left-3 top-3">
            <EstadoOperacion inmueble={inmueble} />
          </div>
        ) : null}
      </div>

      <div className="px-4 py-3.5">
        <p className="text-xs uppercase tracking-wide text-[var(--negocio-tenue)]">
          {TIPOS_INMUEBLE_ES[inmueble.kind]}
          {inmueble.municipality ? ` · ${inmueble.municipality}` : ""}
          {inmueble.operation === "alquiler" ? " · Alquiler" : ""}
        </p>

        <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg leading-snug">
          {inmueble.title}
        </h3>

        <p className="mt-2 text-xl font-semibold">{precioInmueble(inmueble)}</p>
        {porM2 !== null ? (
          <p className="text-xs text-[var(--negocio-tenue)]">{porM2.toLocaleString("es-ES")} €/m²</p>
        ) : null}

        {resumen ? (
          <p className="mt-2 text-sm text-[var(--negocio-tenue)]">{resumen}</p>
        ) : null}

        <div className="mt-3">
          <EtiquetaEnergia letra={inmueble.energy_rating} estado={inmueble.energy_status} />
        </div>

        <p className="mt-2 text-xs text-[var(--negocio-tenue)]">Ref. {inmueble.reference}</p>
      </div>
    </Link>
  );
}

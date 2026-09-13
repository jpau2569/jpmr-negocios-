import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/ui/icono";
import type { NegocioPublico } from "@/types/dominio";
import { enlaceWhatsapp } from "@/lib/formato";

interface Necesidad {
  titulo: string;
  texto: string;
  icono: NombreIcono;
  href: (slug: string) => string;
  externo?: boolean;
}

/**
 * El bloque «¿qué necesitas?».
 *
 * Cada tarjeta lleva a un formulario ya preparado para ese caso, no a un
 * formulario genérico: quien quiere vender no debería tener que explicar primero
 * que quiere vender.
 */
const NECESIDADES: Necesidad[] = [
  { titulo: "Vender una vivienda", texto: "Te llamamos y lo vemos contigo.", icono: "casa", href: (s) => `/b/${s}/contacto?tipo=seller` },
  { titulo: "Comprar una vivienda", texto: "Dinos qué buscas y te avisamos.", icono: "lupa", href: (s) => `/b/${s}/buscar-vivienda` },
  { titulo: "Alquilar una vivienda", texto: "Como propietario o como inquilino.", icono: "llave", href: (s) => `/b/${s}/contacto?tipo=landlord` },
  { titulo: "Valorar un inmueble", texto: "Lo revisa una persona, sin compromiso.", icono: "euro", href: (s) => `/b/${s}/valoracion` },
  { titulo: "Administración de fincas", texto: "Para comunidades de propietarios.", icono: "edificio", href: (s) => `/b/${s}/contacto?tipo=community_administration` },
  { titulo: "Asesoría fiscal, laboral y jurídica", texto: "Cuéntanos tu caso y te damos cita.", icono: "balanza", href: (s) => `/b/${s}/contacto?tipo=tax_labor_legal_consultation` },
  { titulo: "Solicitar cita", texto: "En la oficina, por teléfono o vídeo.", icono: "calendario", href: (s) => `/b/${s}/contacto?tipo=general_consultation` },
];

export function TarjetasNecesidades({ negocio }: { negocio: NegocioPublico }) {
  const whatsapp = enlaceWhatsapp(negocio.whatsapp_phone, `Hola, quiero hablar con un asesor de ${negocio.name}.`);

  return (
    <section aria-labelledby="que-necesitas" className="mx-auto max-w-3xl px-4 py-8">
      <h2 id="que-necesitas" className="text-xl font-bold tracking-tight">
        ¿Qué necesitas?
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {NECESIDADES.map((necesidad) => (
          <Link
            key={necesidad.titulo}
            href={necesidad.href(negocio.slug)}
            className="flex min-h-20 items-start gap-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-4 transition-colors hover:border-[var(--marca)]"
          >
            <Icono nombre={necesidad.icono} className="mt-0.5 size-6 shrink-0 text-[var(--acento)]" />
            <span>
              <span className="block text-sm font-semibold">{necesidad.titulo}</span>
              <span className="block text-xs text-[var(--texto-suave)]">{necesidad.texto}</span>
            </span>
          </Link>
        ))}

        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-20 items-start gap-3 rounded-[var(--radio)] border border-[var(--acento)] bg-[color-mix(in_srgb,var(--acento)_10%,transparent)] p-4"
          >
            <Icono nombre="whatsapp" className="mt-0.5 size-6 shrink-0 text-[var(--acento)]" />
            <span>
              <span className="block text-sm font-semibold">Hablar con un asesor</span>
              <span className="block text-xs text-[var(--texto-suave)]">Por WhatsApp, ahora mismo.</span>
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

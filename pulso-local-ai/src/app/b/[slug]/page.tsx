import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/ui/icono";
import { Aviso } from "@/components/ui/aviso";
import { Rastreador } from "@/components/publico/rastreador";
import { TarjetasNecesidades } from "@/components/publico/tarjetas-necesidades";
import { TarjetaInmueble } from "@/components/publico/tarjeta-inmueble";
import {
  listarFaqs, listarInmuebles, listarMedios, listarServicios,
  obtenerAjustesPublicos, obtenerNegocioPublico,
} from "@/lib/negocio";
import { enlaceWhatsapp } from "@/lib/formato";

export const revalidate = 60;

const ACCIONES_HERO = [
  { texto: "Quiero vender mi vivienda", href: (s: string) => `/b/${s}/contacto?tipo=seller`, principal: true },
  { texto: "Quiero valorar mi inmueble", href: (s: string) => `/b/${s}/valoracion`, principal: true },
  { texto: "Busco vivienda", href: (s: string) => `/b/${s}/buscar-vivienda` },
  { texto: "Quiero alquilar", href: (s: string) => `/b/${s}/contacto?tipo=landlord` },
  { texto: "Solicitar una cita", href: (s: string) => `/b/${s}/contacto?tipo=general_consultation` },
];

export default async function LandingNegocio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  const [ajustes, destacados, servicios, faqs] = await Promise.all([
    obtenerAjustesPublicos(negocio.id),
    listarInmuebles(negocio.id, { limite: 6 }),
    listarServicios(negocio.id),
    listarFaqs(negocio.id),
  ]);
  const medios = await listarMedios(destacados.map((p) => p.id));
  const portadas = new Map(medios.filter((m) => m.is_cover).map((m) => [m.property_id, m]));
  const whatsapp = enlaceWhatsapp(negocio.whatsapp_phone, `Hola, os escribo desde la página de ${negocio.name}.`);

  const porArea = servicios.reduce<Record<string, typeof servicios>>((acc, servicio) => {
    const clave = servicio.category_name ?? "Otros servicios";
    (acc[clave] ??= []).push(servicio);
    return acc;
  }, {});

  return (
    <>
      <Rastreador slug={slug} tipo="public_landing_view" />

      <section className="mx-auto max-w-3xl px-4 pt-8">
        <div className="animar-entrada space-y-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {ajustes?.hero_title ?? "¿Quieres vender, comprar, alquilar o gestionar tu vivienda?"}
          </h2>
          <p className="text-[var(--texto-suave)]">
            {ajustes?.hero_subtitle ??
              "Te ayudamos con un asesoramiento personalizado. Cuéntanos qué necesitas y te contactaremos."}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {ACCIONES_HERO.map((accion) => (
              <Button
                key={accion.texto}
                asChild
                size="lg"
                variant={accion.principal ? "primario" : "contorno"}
                ancho="completo"
              >
                <Link href={accion.href(slug)}>{accion.texto}</Link>
              </Button>
            ))}
            {whatsapp ? (
              <Button asChild size="lg" variant="acento" ancho="completo">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <Icono nombre="whatsapp" />
                  Hablar por WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <TarjetasNecesidades negocio={negocio} />

      {destacados.length ? (
        <section aria-labelledby="inmuebles" className="mx-auto max-w-3xl px-4 py-8">
          <div className="flex items-end justify-between gap-3">
            <h2 id="inmuebles" className="text-xl font-bold tracking-tight">
              Inmuebles disponibles
            </h2>
            <Link href={`/b/${slug}/inmuebles`} className="text-sm font-semibold underline underline-offset-4">
              Ver todos
            </Link>
          </div>

          {negocio.is_demo_data ? (
            <Aviso tono="aviso" className="mt-4">
              Los inmuebles de este espacio son de demostración. Consulta disponibilidad real con el equipo.
            </Aviso>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {destacados.map((inmueble) => (
              <TarjetaInmueble
                key={inmueble.id}
                inmueble={inmueble}
                portada={portadas.get(inmueble.id)}
                slugNegocio={slug}
              />
            ))}
          </div>
        </section>
      ) : null}

      {servicios.length ? (
        <section aria-labelledby="servicios" className="mx-auto max-w-3xl px-4 py-8">
          <div className="flex items-end justify-between gap-3">
            <h2 id="servicios" className="text-xl font-bold tracking-tight">
              Nuestros servicios
            </h2>
            <Link href={`/b/${slug}/servicios`} className="text-sm font-semibold underline underline-offset-4">
              Ver todos
            </Link>
          </div>
          <div className="mt-4 space-y-5">
            {Object.entries(porArea).map(([categoria, lista]) => (
              <div key={categoria}>
                <h3 className="text-sm font-semibold text-[var(--acento)]">{categoria}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {lista.slice(0, 4).map((servicio) => (
                    <li key={servicio.id}>
                      <Link
                        href={`/b/${slug}/servicios#${servicio.slug}`}
                        className="block rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-3 text-sm hover:border-[var(--marca)]"
                      >
                        <span className="font-semibold">{servicio.name}</span>
                        {servicio.short_description ? (
                          <span className="mt-1 block text-xs text-[var(--texto-suave)]">
                            {servicio.short_description}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {faqs.length ? (
        <section aria-labelledby="faqs" className="mx-auto max-w-3xl px-4 py-8">
          <h2 id="faqs" className="text-xl font-bold tracking-tight">
            Preguntas frecuentes
          </h2>
          <div className="mt-4 divide-y divide-[var(--borde)] overflow-hidden rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)]">
            {faqs.map((faq) => (
              <details key={faq.id} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold">
                  {faq.question}
                  <Icono nombre="flecha" className="size-4 shrink-0 rotate-90 transition-transform group-open:-rotate-90" />
                </summary>
                <p className="px-4 pb-4 text-sm text-[var(--texto-suave)]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-[var(--radio)] bg-[var(--marca)] p-6 text-[var(--marca-contraste)]">
          <h2 className="text-lg font-bold">¿Ya has estado con nosotros?</h2>
          <p className="mt-2 text-sm opacity-90">
            Cuéntanos cómo ha ido. Se lee, se responde y sirve para mejorar.
          </p>
          <Button asChild variant="acento" className="mt-4">
            <Link href={`/b/${slug}/opinion`}>Dejar mi opinión</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

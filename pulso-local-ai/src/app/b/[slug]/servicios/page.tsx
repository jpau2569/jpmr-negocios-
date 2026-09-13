import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/ui/icono";
import { Aviso } from "@/components/ui/aviso";
import { Rastreador } from "@/components/publico/rastreador";
import { listarServicios, obtenerNegocioPublico } from "@/lib/negocio";
import { enlaceLlamada, enlaceWhatsapp } from "@/lib/formato";

export const revalidate = 60;
export const metadata = { title: "Servicios" };

export default async function PaginaServicios({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ area?: string }>;
}) {
  const { slug } = await params;
  const { area } = await searchParams;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  const todos = await listarServicios(negocio.id);
  const servicios = area ? todos.filter((s) => s.area === area) : todos;

  const porCategoria = servicios.reduce<Record<string, typeof servicios>>((acc, servicio) => {
    const clave = servicio.category_name ?? "Otros servicios";
    (acc[clave] ??= []).push(servicio);
    return acc;
  }, {});

  const whatsapp = enlaceWhatsapp(negocio.whatsapp_phone, `Hola, quiero información sobre los servicios de ${negocio.name}.`);
  const llamada = enlaceLlamada(negocio.phone);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Rastreador slug={slug} tipo="service_view" />

      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Gestión inmobiliaria, administración de fincas y asesoría fiscal, laboral y jurídica.
        </p>
      </header>

      <Aviso tono="info" className="mb-6">
        La información de esta página es orientativa. Para tu caso concreto, habla con una persona del equipo: no
        damos asesoramiento personalizado por escrito sin conocer la situación.
      </Aviso>

      <div className="space-y-8">
        {Object.entries(porCategoria).map(([categoria, lista]) => (
          <div key={categoria}>
            <h2 className="text-lg font-bold tracking-tight text-[var(--marca)]">{categoria}</h2>
            <div className="mt-3 space-y-4">
              {lista.map((servicio) => (
                <article
                  key={servicio.id}
                  id={servicio.slug}
                  className="scroll-mt-6 overflow-hidden rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)]"
                >
                  {servicio.image_url ? (
                    <div className="relative aspect-[16/7] w-full">
                      <Image src={servicio.image_url} alt="" fill sizes="100vw" className="object-cover" />
                    </div>
                  ) : null}

                  <div className="space-y-3 p-5">
                    <h3 className="text-base font-semibold">{servicio.name}</h3>
                    {servicio.description ? (
                      <p className="text-sm text-[var(--texto-suave)]">{servicio.description}</p>
                    ) : null}

                    {Array.isArray(servicio.benefits) && servicio.benefits.length ? (
                      <ul className="space-y-1.5">
                        {servicio.benefits.map((beneficio) => (
                          <li key={beneficio} className="flex items-start gap-2 text-sm">
                            <Icono nombre="ok" className="mt-0.5 size-4 shrink-0 text-[var(--exito)]" />
                            {beneficio}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                      <Button asChild ancho="completo">
                        <Link href={`/b/${slug}/contacto?tipo=general_consultation`}>
                          {servicio.cta_label ?? "Solicitar información"}
                        </Link>
                      </Button>
                      {whatsapp ? (
                        <Button asChild variant="acento" ancho="completo">
                          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                      ) : null}
                      {llamada ? (
                        <Button asChild variant="contorno" ancho="completo">
                          <a href={llamada}>Pedir cita</a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!servicios.length ? (
        <p className="text-sm text-[var(--texto-suave)]">Todavía no hay servicios publicados en este espacio.</p>
      ) : null}
    </section>
  );
}

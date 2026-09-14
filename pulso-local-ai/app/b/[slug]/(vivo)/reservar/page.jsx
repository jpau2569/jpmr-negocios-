import { notFound } from "next/navigation";
import { leerEspacio, hayBackend } from "@/lib/datos";
import { FormularioReserva } from "@/components/publico/formulario-reserva";
import { IniciarAnalitica } from "@/components/publico/rastreador";
import { Aviso } from "@/components/ui/basicos";
import { horarioLegible } from "@/lib/horarios";
export const revalidate = 60;
export default async function PaginaReservar({ params, searchParams }) {
    const { slug } = await params;
    const { qr } = await searchParams;
    const espacio = await leerEspacio(slug);
    if (!espacio)
        notFound();
    const { negocio, ajustes } = espacio;
    const horario = horarioLegible(ajustes.opening_hours ?? []);
    return (<div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null}/>
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">Reservar mesa</h1>
        <p className="mt-1.5 text-sm text-[var(--negocio-tenue)]">
          Dinos cuándo y cuántos sois. {negocio.name} te confirma la disponibilidad.
        </p>

        {horario.length === 0 ? (<Aviso className="mt-4">
            El horario del local todavía no está confirmado, así que elige el día y la hora que te
            venga bien y ellos te dirán si pueden.
          </Aviso>) : null}

        <div className="mt-6">
          <FormularioReserva slug={slug} negocio={negocio.name} telefono={ajustes.phone} whatsapp={ajustes.whatsapp}/>
        </div>

        {!hayBackend() ? (<Aviso tono="error" className="mt-5">
            <strong>Demostración.</strong> Todavía no hay base de datos conectada, así que lo que
            envíes no se guarda en ningún sitio. Sirve para ver cómo funciona.
          </Aviso>) : null}
      </div>
    </div>);
}

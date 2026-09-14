import Link from "next/link";
import { EnlaceBoton } from "@/components/ui/boton";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { Rastreador } from "./rastreador";
// ============================================================================
//  Hero
// ----------------------------------------------------------------------------
//  Lo primero que ve alguien que acaba de escanear con el móvil en la mano.
//  Cuatro acciones, ni una más: qué hay hoy, la carta, reservar y WhatsApp.
//  Si el negocio no tiene WhatsApp configurado, ese botón no existe — no se
//  pinta uno roto ni se sustituye por otro número.
// ============================================================================
export function Hero({ espacio }) {
    const { negocio, ajustes, menuDeHoy } = espacio;
    const base = `/b/${negocio.slug}`;
    const modulos = ajustes.modules ?? {};
    const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "reserva" });
    const hayMenuHoy = Boolean(menuDeHoy) && modulos.daily_menu !== false;
    return (<section className="relative overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      {ajustes.cover_url ? (<>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ajustes.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25"/>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--negocio-fondo)]"/>
        </>) : null}

      <div className="relative mx-auto w-full max-w-3xl animate-[var(--animate-subir)]">
        <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.12] sm:text-5xl">
          Hoy se come, se brinda y se disfruta.
        </h1>
        <p className="mt-3 max-w-xl text-[0.98rem] leading-relaxed text-[var(--negocio-tenue)] sm:text-lg">
          Consulta la carta, descubre el menú de hoy y reserva tu mesa en unos segundos.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {hayMenuHoy ? (<EnlaceBoton href="#menu-del-dia" variante="principal" tamano="lg" className="neon">
              Ver el menú de hoy
            </EnlaceBoton>) : null}

          {modulos.menu !== false ? (<Link href={`${base}/carta`} className="contents">
              <EnlaceBoton href={`${base}/carta`} variante="contorno" tamano="lg">
                Ver la carta
              </EnlaceBoton>
            </Link>) : null}

          {modulos.reservations ? (<EnlaceBoton href={`${base}/reservar`} variante="acento" tamano="lg">
              Reservar mesa
            </EnlaceBoton>) : null}

          {wasap ? (<Rastreador evento="whatsapp_click">
              <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="plano" tamano="lg">
                Hablar por WhatsApp
              </EnlaceBoton>
            </Rastreador>) : null}
        </div>
      </div>
    </section>);
}

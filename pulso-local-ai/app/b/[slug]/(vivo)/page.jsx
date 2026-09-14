import Link from "next/link";
import { notFound } from "next/navigation";
import { leerEspacio, destacados, especialesVigentes, platosConEtiqueta } from "@/lib/datos";
import { Seccion, Tarjeta, Vacio, SinConfirmar } from "@/components/ui/basicos";
import { EnlaceBoton } from "@/components/ui/boton";
import { Hero } from "@/components/publico/hero";
import { MenuDelDia } from "@/components/publico/menu-dia";
import { FichaPlato } from "@/components/publico/plato";
import { IniciarAnalitica, Vista, Rastreador } from "@/components/publico/rastreador";
import { BloqueFidelizacion } from "@/components/publico/fidelizacion";
import { euros, fechaLarga } from "@/lib/utils";
import { enlaceWhatsapp } from "@/lib/whatsapp";
export default async function PaginaNegocio({ params, searchParams }) {
    const { slug } = await params;
    const { qr } = await searchParams;
    const espacio = await leerEspacio(slug);
    if (!espacio)
        notFound();
    const { negocio, ajustes, categorias } = espacio;
    const base = `/b/${negocio.slug}`;
    const modulos = ajustes.modules ?? {};
    const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "grupo" });
    const recomendados = destacados(espacio, 6);
    const paraCompartir = platosConEtiqueta(espacio, "para_compartir").slice(0, 6);
    const especiales = especialesVigentes(espacio);
    return (<>
      <IniciarAnalitica slug={slug} qr={qr ?? null}/>

      <Hero espacio={espacio}/>

      {modulos.daily_menu !== false ? <MenuDelDia espacio={espacio}/> : null}

      {/* --- Platos destacados --- */}
      {recomendados.length > 0 ? (<Seccion id="destacados" titulo="Lo que más piden" descripcion="Si vienes por primera vez, empieza por aquí.">
          <Tarjeta className="px-5 py-1">
            {recomendados.map((p) => (<FichaPlato key={p.id} plato={p} negocio={negocio.name} whatsapp={ajustes.whatsapp}/>))}
          </Tarjeta>
        </Seccion>) : null}

      {/* --- Raciones para compartir --- */}
      {paraCompartir.length > 0 ? (<Seccion id="compartir" titulo="Para compartir" descripcion="Para el centro de la mesa.">
          <Tarjeta className="px-5 py-1">
            {paraCompartir.map((p) => (<FichaPlato key={p.id} plato={p} negocio={negocio.name} whatsapp={ajustes.whatsapp}/>))}
          </Tarjeta>
        </Seccion>) : null}

      {/* --- Carta --- */}
      {modulos.menu !== false ? (<Seccion id="carta" titulo="La carta" descripcion={`${espacio.platos.length} platos en ${categorias.length} apartados.`}>
          <Vista evento="menu_view"/>
          {categorias.length === 0 ? (<Vacio>La carta todavía no está cargada.</Vacio>) : (<>
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (<Link key={c.id} href={`${base}/carta#categoria-${c.id}`} className="rounded-full border border-[var(--negocio-borde)] px-3.5 py-2 text-sm transition-colors hover:border-[var(--negocio-acento)]">
                    {c.name}
                  </Link>))}
              </div>
              <EnlaceBoton href={`${base}/carta`} variante="contorno" tamano="bloque" className="mt-4">
                Ver la carta completa
              </EnlaceBoton>
            </>)}
        </Seccion>) : null}

      {/* --- Menús especiales --- */}
      {modulos.special_menus !== false && especiales.length > 0 ? (<Seccion id="especiales" titulo="Menús especiales" descripcion="Fines de semana, celebraciones y jornadas.">
          <Vista evento="special_menu_view"/>
          <div className="grid gap-4 sm:grid-cols-2">
            {especiales.map((m) => (<Tarjeta key={m.id} className="p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg">{m.name}</h3>
                {m.description ? (<p className="mt-1 text-sm leading-snug text-[var(--negocio-tenue)]">{m.description}</p>) : null}
                {m.price_cents !== null ? (<p className="mt-2 font-semibold">{euros(m.price_cents)}</p>) : null}
                {m.starts_on || m.ends_on ? (<p className="mt-1 text-xs text-[var(--negocio-tenue)]">
                    {m.starts_on ? `Del ${fechaLarga(m.starts_on)}` : ""}
                    {m.ends_on ? ` al ${fechaLarga(m.ends_on)}` : ""}
                  </p>) : null}
                {m.conditions ? (<p className="mt-2 text-xs text-[var(--negocio-tenue)]">{m.conditions}</p>) : null}
                {m.is_demo ? <SinConfirmar className="mt-3"/> : null}
              </Tarjeta>))}
          </div>
        </Seccion>) : null}

      {/* --- Reservas --- */}
      {modulos.reservations ? (<Seccion id="reservas" titulo="Reservar mesa" descripcion="Dinos cuándo y cuántos sois y te confirmamos.">
          <Tarjeta className="p-5">
            <p className="text-sm leading-relaxed text-[var(--negocio-tenue)]">
              La reserva no queda confirmada hasta que el local responde: te escribimos o te
              llamamos para cerrarla.
            </p>
            <EnlaceBoton href={`${base}/reservar`} variante="principal" tamano="bloque" className="mt-4">
              Pedir mesa
            </EnlaceBoton>
          </Tarjeta>
        </Seccion>) : null}

      {/* --- Grupos y celebraciones --- */}
      {modulos.groups ? (<Seccion id="grupos" titulo="¿Celebras algo? Cuéntanos tu plan." descripcion="Comuniones, cumpleaños, comidas de empresa o cenas de amigos.">
          <Tarjeta className="p-5">
            <p className="text-sm leading-relaxed text-[var(--negocio-tenue)]">
              Cuéntanos cuántos sois y qué día, y te preparamos una propuesta con menú cerrado.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <EnlaceBoton href={`${base}/grupos`} variante="acento">Contar mi plan</EnlaceBoton>
              {wasap ? (<Rastreador evento="whatsapp_click">
                  <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="contorno">
                    Preguntar por WhatsApp
                  </EnlaceBoton>
                </Rastreador>) : null}
            </div>
          </Tarjeta>
        </Seccion>) : null}

      {/* --- Eventos --- */}
      {modulos.events !== false && espacio.eventos.length > 0 ? (<Seccion id="eventos" titulo="Eventos y novedades">
          <div className="grid gap-4 sm:grid-cols-2">
            {espacio.eventos.map((e) => (<Tarjeta key={e.id} className="p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg">{e.name}</h3>
                {e.starts_at ? (<p className="mt-1 text-xs text-[var(--negocio-tenue)]">
                    {fechaLarga(e.starts_at.slice(0, 10))}
                  </p>) : null}
                {e.description ? (<p className="mt-2 text-sm text-[var(--negocio-tenue)]">{e.description}</p>) : null}
                {e.is_demo ? <SinConfirmar className="mt-3"/> : null}
              </Tarjeta>))}
          </div>
        </Seccion>) : null}

      {/* --- Fidelización --- */}
      {modulos.loyalty ? <BloqueFidelizacion espacio={espacio}/> : null}

      {/* --- Opiniones --- */}
      {modulos.feedback !== false ? (<Seccion id="opiniones" titulo="¿Qué tal ha ido?" descripcion="Nos vale más tu opinión sincera que cinco estrellas de compromiso.">
          <Tarjeta className="p-5">
            <p className="text-sm leading-relaxed text-[var(--negocio-tenue)]">
              Cuéntanoslo en treinta segundos. Lo lee el dueño, no una máquina.
            </p>
            <EnlaceBoton href={`${base}/opinion`} variante="contorno" tamano="bloque" className="mt-4">
              Dejar mi opinión
            </EnlaceBoton>
          </Tarjeta>
        </Seccion>) : null}
    </>);
}

import { Tarjeta, SinConfirmar } from "@/components/ui/basicos";
import { EnlaceBoton } from "@/components/ui/boton";
import { euros, fechaLarga } from "@/lib/utils";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { Rastreador, Vista } from "./rastreador";
// ============================================================================
//  Menú del día — la sección principal
// ----------------------------------------------------------------------------
//  Va la primera y con el mayor contraste de la página, porque es lo que quiere
//  ver AHORA la persona que acaba de sentarse. La carta completa puede esperar
//  al segundo scroll; el menú de hoy, no.
//
//  Se destaca solo cuando hay uno publicado para la fecha en curso: si el
//  negocio no lo ha cargado, la sección no aparece en vez de enseñar el de
//  ayer, que sería peor que nada.
// ============================================================================
const ORDEN_CURSOS = ["primero", "segundo", "postre", "bebida"];
const TITULO_CURSO = {
    primero: "Primeros",
    segundo: "Segundos",
    postre: "Postres",
    bebida: "Bebida",
};
export function MenuDelDia({ espacio }) {
    const menu = espacio.menuDeHoy;
    if (!menu)
        return null;
    const { negocio, ajustes } = espacio;
    const base = `/b/${negocio.slug}`;
    const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "menu_dia" });
    const porCurso = ORDEN_CURSOS
        .map((curso) => ({
        curso,
        platos: menu.platos.filter((p) => p.course === curso).sort((a, b) => a.position - b.position),
    }))
        .filter((g) => g.platos.length > 0);
    return (<section id="menu-del-dia" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <Vista evento="daily_menu_view" subjectId={menu.id}/>

      <Tarjeta className="mx-auto w-full max-w-3xl border-[var(--negocio-acento)]/30">
        <div className="border-b border-[var(--negocio-borde)] bg-[var(--negocio-acento)]/[0.07] px-5 py-4 sm:px-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--negocio-acento)]">
            Menú del día
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl capitalize sm:text-3xl">
            {fechaLarga(menu.service_date)}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--negocio-tenue)]">
            {menu.price_cents !== null ? (<span className="text-base font-semibold text-[var(--negocio-texto)]">
                {euros(menu.price_cents)}
              </span>) : null}
            {menu.includes_drink ? <span>Bebida incluida</span> : null}
            {menu.status === "sold_out" ? (<span className="font-semibold text-red-300">Agotado por hoy</span>) : null}
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {porCurso.length === 0 ? (<p className="text-sm text-[var(--negocio-tenue)]">
              El menú de hoy todavía no está cargado. Pregunta en la barra o llámanos.
            </p>) : (<div className="grid gap-5 sm:grid-cols-2">
              {porCurso.map(({ curso, platos }) => (<div key={curso}>
                  <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--negocio-acento)]">
                    {TITULO_CURSO[curso] ?? curso}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {platos.map((p) => (<li key={p.id} className="text-[0.95rem] leading-snug">
                        {p.name}
                        {p.description ? (<span className="block text-xs text-[var(--negocio-tenue)]">{p.description}</span>) : null}
                      </li>))}
                  </ul>
                </div>))}
            </div>)}

          {menu.notes ? (<p className="mt-4 text-xs leading-relaxed text-[var(--negocio-tenue)]">{menu.notes}</p>) : null}

          {menu.is_demo ? (<SinConfirmar className="mt-4" texto="Menú de muestra para enseñar cómo funciona esta sección. El del día lo carga el negocio."/>) : null}

          <div className="mt-5 flex flex-wrap gap-2.5">
            {ajustes.modules?.reservations ? (<EnlaceBoton href={`${base}/reservar`} variante="principal">
                Reservar para hoy
              </EnlaceBoton>) : null}
            {wasap ? (<Rastreador evento="whatsapp_click" subjectId={menu.id}>
                <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="contorno">
                  Consultar disponibilidad
                </EnlaceBoton>
              </Rastreador>) : null}
          </div>

          {/* Alérgenos: en un menú del día que cambia a diario, la única
            respuesta honesta es preguntar en el local. */}
          <p className="mt-4 text-[0.7rem] leading-relaxed text-[var(--negocio-tenue)]">
            Si tienes alguna alergia o intolerancia, dilo al personal antes de pedir: el menú
            cambia cada día y te confirmarán los ingredientes en el momento.
          </p>
        </div>
      </Tarjeta>
    </section>);
}

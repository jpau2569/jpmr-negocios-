import Link from "next/link";
import { EnlaceBoton } from "@/components/ui/boton";
import { enlaceMapa, enlaceTelefono, enlaceWhatsapp } from "@/lib/whatsapp";
import { estadoAhora, textoApertura } from "@/lib/horarios";
import { Rastreador } from "./rastreador";
// ============================================================================
//  Cabecera
// ----------------------------------------------------------------------------
//  Lo que alguien sentado en una mesa necesita en los primeros dos segundos:
//  dónde está, si está abierto y cómo llamar. El estado abierto/cerrado SOLO
//  aparece si el negocio ha configurado horario real (lib/horarios.ts): decir
//  "abierto" cuando está cerrado hace que la gente se plante en la puerta y no
//  vuelva.
// ============================================================================
export function Cabecera({ espacio }) {
    const { negocio, ajustes } = espacio;
    const base = `/b/${negocio.slug}`;
    const tel = enlaceTelefono(ajustes.phone);
    const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "general" });
    const mapa = enlaceMapa(ajustes.address, ajustes.lat, ajustes.lng);
    const apertura = textoApertura(estadoAhora(ajustes.opening_hours ?? []));
    return (<header className="sticky top-0 z-40 border-b border-[var(--negocio-borde)] bg-[var(--negocio-fondo)]/92 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        {ajustes.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ajustes.logo_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover"/>) : null}

        <div className="min-w-0 flex-1">
          <Link href={base} className="block truncate font-[family-name:var(--font-display)] text-lg leading-tight">
            {negocio.name}
          </Link>
          {apertura ? (<p className="truncate text-xs text-[var(--negocio-tenue)]">{apertura}</p>) : ajustes.address ? (<p className="truncate text-xs text-[var(--negocio-tenue)]">{ajustes.address}</p>) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {tel ? (<Rastreador evento="call_click">
              <EnlaceBoton href={tel} variante="plano" tamano="sm" aria-label="Llamar por teléfono">
                <span aria-hidden="true">📞</span>
                <span className="hidden sm:inline">Llamar</span>
              </EnlaceBoton>
            </Rastreador>) : null}

          {wasap ? (<Rastreador evento="whatsapp_click">
              <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal" tamano="sm">
                <span aria-hidden="true">💬</span>
                <span className="hidden sm:inline">WhatsApp</span>
              </EnlaceBoton>
            </Rastreador>) : null}

          {mapa ? (<Rastreador evento="directions_click">
              <EnlaceBoton href={mapa} target="_blank" rel="noopener" variante="plano" tamano="sm" aria-label="Cómo llegar">
                <span aria-hidden="true">📍</span>
              </EnlaceBoton>
            </Rastreador>) : null}
        </div>
      </div>
    </header>);
}

"use client";

import { Icono } from "@/components/ui/icono";
import { registrar } from "@/lib/cliente/eventos";

/**
 * Barra fija de acciones en móvil.
 *
 * Va fija porque la ficha de un inmueble se lee de arriba abajo y, cuando la
 * persona decide, no debería tener que volver a buscar el botón. En escritorio
 * desaparece: allí los botones del lateral ya están a la vista.
 */
export function CtaFijoMovil({
  slug,
  propertyId,
  whatsapp,
  llamada,
  hrefVisita,
}: {
  slug: string;
  propertyId?: string;
  whatsapp?: string | null;
  llamada?: string | null;
  hrefVisita: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--borde)] bg-[var(--superficie)]/95 backdrop-blur sm:hidden">
      <div className="seguro-abajo mx-auto flex max-w-3xl gap-2 px-3 pt-3">
        <a
          href={hrefVisita}
          className="flex min-h-12 flex-1 items-center justify-center rounded-[var(--radio)] bg-[var(--marca)] text-sm font-semibold text-[var(--marca-contraste)]"
        >
          Solicitar visita
        </a>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void registrar(slug, "whatsapp_click", propertyId ? { propertyId } : {})}
            aria-label="Hablar por WhatsApp"
            className="flex size-12 items-center justify-center rounded-[var(--radio)] bg-[var(--acento)] text-[var(--acento-contraste)]"
          >
            <Icono nombre="whatsapp" />
          </a>
        ) : null}
        {llamada ? (
          <a
            href={llamada}
            onClick={() => void registrar(slug, "call_click", propertyId ? { propertyId } : {})}
            aria-label="Llamar por teléfono"
            className="flex size-12 items-center justify-center rounded-[var(--radio)] border border-[var(--borde)]"
          >
            <Icono nombre="telefono" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

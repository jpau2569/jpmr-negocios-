"use client";

import Image from "next/image";
import { useState } from "react";
import { Icono } from "@/components/ui/icono";
import { registrar } from "@/lib/cliente/eventos";
import type { MedioPublico } from "@/types/dominio";

/**
 * Galería de la ficha.
 *
 * Solo la primera foto se carga con prioridad; el resto van diferidas. En una
 * ficha con doce fotos, cargarlas todas de golpe sobre datos móviles es la
 * diferencia entre una página que abre en un segundo y una que no abre.
 */
export function GaleriaInmueble({
  fotos,
  titulo,
  slug,
  propertyId,
}: {
  fotos: MedioPublico[];
  titulo: string;
  slug: string;
  propertyId: string;
}) {
  const [indice, setIndice] = useState(0);

  if (!fotos.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--radio)] bg-[var(--superficie-2)] text-[var(--texto-suave)]">
        <Icono nombre="camara" className="size-10" />
      </div>
    );
  }

  const actual = fotos[Math.min(indice, fotos.length - 1)]!;

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radio)] bg-[var(--superficie-2)]">
        <Image
          src={actual.url}
          alt={actual.alt_text ?? titulo}
          fill
          priority={indice === 0}
          sizes="(max-width: 768px) 100vw, 700px"
          className="object-cover"
        />
        {fotos.length > 1 ? (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
            {indice + 1} / {fotos.length}
          </span>
        ) : null}
      </div>

      {fotos.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {fotos.map((foto, i) => (
            <li key={foto.id}>
              <button
                type="button"
                onClick={() => {
                  setIndice(i);
                  if (i === 1) void registrar(slug, "property_gallery_view", { propertyId });
                }}
                aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                aria-current={i === indice}
                className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                  i === indice ? "border-[var(--marca)]" : "border-transparent"
                }`}
              >
                <Image src={foto.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

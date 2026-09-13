"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { alternarPublicacion, archivarInmueble, duplicarInmueble } from "@/app/dashboard/inmuebles/acciones";

export function AccionesInmueble({
  propertyId,
  publicado,
  slugNegocio,
  slugInmueble,
}: {
  propertyId: string;
  publicado: boolean;
  slugNegocio: string;
  slugInmueble: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);

  const boton = "text-xs font-semibold underline underline-offset-4 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/inmuebles/${propertyId}`} className={boton}>
          Editar
        </Link>
        <button
          type="button"
          className={boton}
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarPublicacion(propertyId, !publicado);
              setMensaje(r.error ?? (publicado ? "Retirado de la web" : "Publicado"));
            })
          }
        >
          {publicado ? "Retirar" : "Publicar"}
        </button>
        <button
          type="button"
          className={boton}
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await duplicarInmueble(propertyId);
              setMensaje(r.error ?? "Duplicado como borrador");
            })
          }
        >
          Duplicar
        </button>
        {publicado ? (
          <Link href={`/b/${slugNegocio}/inmuebles/${slugInmueble}`} target="_blank" className={boton}>
            Ver ficha
          </Link>
        ) : null}
      </div>

      {/* Archivar pide confirmación: retira el inmueble de la web y no es lo
          mismo que despublicarlo temporalmente. */}
      {confirmarArchivo ? (
        <div className="flex items-center gap-2 text-xs">
          <span>¿Archivar?</span>
          <button
            type="button"
            className="font-semibold text-[var(--peligro)] underline"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await archivarInmueble(propertyId);
                setMensaje(r.error ?? "Archivado");
                setConfirmarArchivo(false);
              })
            }
          >
            Sí, archivar
          </button>
          <button type="button" className="underline" onClick={() => setConfirmarArchivo(false)}>
            No
          </button>
        </div>
      ) : (
        <button type="button" className={`${boton} text-left text-[var(--texto-suave)]`} onClick={() => setConfirmarArchivo(true)}>
          Archivar
        </button>
      )}

      {mensaje ? (
        <p role="status" className="text-xs text-[var(--exito)]">
          {mensaje}
        </p>
      ) : null}
    </div>
  );
}

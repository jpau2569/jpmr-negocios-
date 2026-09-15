"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ajustarDemo, anadirNotaComercial, cambiarEstadoNegocio } from "@/app/admin/acciones";
import { ETIQUETA_ESTADO_NEGOCIO } from "@/lib/etiquetas";
import { diasHasta, fechaCorta } from "@/lib/formato";
import type { NegocioSaas } from "@/app/admin/page";

const TONOS = { trial: "aviso", active: "exito", suspended: "neutro", expired: "peligro" } as const;

export function FichaNegocioSaas({ negocio, leads }: { negocio: NegocioSaas; leads: number }) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const dias = negocio.status === "trial" ? diasHasta(negocio.trial_ends_at) : null;

  return (
    <article className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{negocio.name}</h3>
            <Badge tono={TONOS[negocio.status]}>{ETIQUETA_ESTADO_NEGOCIO[negocio.status]}</Badge>
            {negocio.is_demo_data ? <Badge tono="contorno">Contenido demo</Badge> : null}
          </div>
          <p className="text-xs text-[var(--texto-suave)]">
            /b/{negocio.slug}
            {negocio.city ? ` · ${negocio.city}` : ""} · alta {fechaCorta(negocio.created_at)} · {leads} leads
            {dias !== null ? ` · quedan ${dias} días` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild size="sm" variant="contorno">
            <Link href={`/b/${negocio.slug}`} target="_blank">
              Ver landing
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["trial", "active", "suspended", "expired"] as const).map((estado) => (
          <button
            key={estado}
            type="button"
            disabled={pendiente || estado === negocio.status}
            onClick={() =>
              iniciar(async () => {
                const r = await cambiarEstadoNegocio(negocio.id, estado);
                setMensaje(r.error ?? `Ahora está en «${ETIQUETA_ESTADO_NEGOCIO[estado]}»`);
              })
            }
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              estado === negocio.status
                ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                : "border-[var(--borde)]"
            }`}
          >
            {ETIQUETA_ESTADO_NEGOCIO[estado]}
          </button>
        ))}

        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await ajustarDemo(negocio.id, d);
                setMensaje(r.error ?? `Demo reiniciada a ${d} días`);
              })
            }
            className="rounded-full border border-[var(--borde)] px-3 py-1.5 text-xs font-semibold"
          >
            Demo {d} d
          </button>
        ))}
      </div>

      <form
        action={(datos) =>
          iniciar(async () => {
            const r = await anadirNotaComercial(negocio.id, datos);
            setMensaje(r.error ?? "Nota comercial guardada");
          })
        }
        className="flex gap-2"
      >
        <input
          name="nota"
          placeholder="Nota comercial: con quién hablaste, qué falta para cerrar…"
          maxLength={2000}
          required
          className="min-h-11 flex-1 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={pendiente}>
          Guardar
        </Button>
      </form>

      {mensaje ? (
        <p role="status" className="text-xs text-[var(--exito)]">
          {mensaje}
        </p>
      ) : null}
    </article>
  );
}

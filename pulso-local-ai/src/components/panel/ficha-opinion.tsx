"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/ui/icono";
import { resolverOpinion } from "@/app/dashboard/feedback/acciones";
import { ETIQUETA_ESTADO_OPINION } from "@/lib/etiquetas";
import { enlaceLlamada, fechaHora } from "@/lib/formato";
import type { Opinion } from "@/types/dominio";

export function FichaOpinion({ opinion }: { opinion: Opinion }) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const baja = opinion.rating <= 3;

  return (
    <article
      className={`space-y-3 rounded-[var(--radio)] border p-4 ${
        baja && opinion.status !== "resuelto"
          ? "border-[var(--aviso)] bg-[color-mix(in_srgb,var(--aviso)_6%,var(--superficie))]"
          : "border-[var(--borde)] bg-[var(--superficie)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex" aria-label={`${opinion.rating} de 5 estrellas`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icono
                  key={n}
                  nombre="estrella"
                  className={`size-4 ${n <= opinion.rating ? "text-[var(--acento)]" : "text-[var(--borde)]"}`}
                />
              ))}
            </span>
            <Badge tono={opinion.status === "resuelto" ? "exito" : baja ? "aviso" : "neutro"}>
              {ETIQUETA_ESTADO_OPINION[opinion.status]}
            </Badge>
            {opinion.is_demo_data ? <Badge tono="aviso">Demo</Badge> : null}
          </div>
          <p className="text-xs text-[var(--texto-suave)]">{fechaHora(opinion.created_at)}</p>
          {opinion.comment ? <p className="text-sm">{opinion.comment}</p> : null}
          {opinion.wants_contact ? (
            <p className="text-xs font-semibold text-[var(--aviso)]">
              Ha pedido que le contactéis
              {opinion.contact_name ? `: ${opinion.contact_name}` : ""}
              {opinion.contact_phone ? ` · ${opinion.contact_phone}` : ""}
            </p>
          ) : null}
        </div>

        {opinion.contact_phone ? (
          <Button asChild size="sm" variant="contorno">
            <a href={enlaceLlamada(opinion.contact_phone)!}>Llamar</a>
          </Button>
        ) : null}
      </div>

      <form
        action={(datos) =>
          iniciar(async () => {
            const r = await resolverOpinion(opinion.id, datos);
            setMensaje(r.error ?? "Guardado");
          })
        }
        className="flex flex-wrap gap-2"
      >
        <input
          name="nota"
          defaultValue={opinion.internal_note ?? ""}
          placeholder="Nota interna: qué se hizo"
          maxLength={1000}
          className="min-h-11 flex-1 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
        />
        <select
          name="estado"
          defaultValue={opinion.status}
          className="min-h-11 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-2 text-sm"
        >
          <option value="nuevo">Sin revisar</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelto">Resuelta</option>
        </select>
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

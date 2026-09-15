"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cambiarEstadoVisita } from "@/app/dashboard/visitas/acciones";
import { ETIQUETA_ESTADO_VISITA, ETIQUETA_MODO_VISITA } from "@/lib/etiquetas";
import { enlaceLlamada, enlaceWhatsapp, fechaCorta, fechaHora } from "@/lib/formato";
import type { VisitaConDatos } from "@/app/dashboard/visitas/page";
import type { EstadoVisita } from "@/types/dominio";

const ESTADOS: EstadoVisita[] = ["pendiente", "confirmado", "realizado", "cancelado"];

const TONO: Record<EstadoVisita, "aviso" | "exito" | "neutro"> = {
  pendiente: "aviso",
  confirmado: "exito",
  realizado: "exito",
  cancelado: "neutro",
};

export function FilaVisita({ visita }: { visita: VisitaConDatos }) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const telefono = visita.leads?.phone ?? null;
  const whatsapp = enlaceWhatsapp(
    telefono,
    `Hola ${visita.leads?.name?.split(" ")[0] ?? ""}, te escribo para confirmar la visita${
      visita.properties ? ` a "${visita.properties.title}"` : ""
    }.`,
  );

  return (
    <article className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{visita.leads?.name ?? "Sin datos de contacto"}</h2>
            <Badge tono={TONO[visita.status]}>{ETIQUETA_ESTADO_VISITA[visita.status]}</Badge>
            <Badge tono="contorno">{ETIQUETA_MODO_VISITA[visita.mode]}</Badge>
          </div>
          <p className="text-xs text-[var(--texto-suave)]">
            Pedida el {fechaHora(visita.created_at)}
            {telefono ? ` · ${telefono}` : ""}
          </p>
          <p className="text-sm">
            {visita.properties ? <strong>{visita.properties.title}</strong> : "Sin inmueble asociado"}
            {visita.preferred_date ? ` · Prefiere el ${fechaCorta(visita.preferred_date)}` : ""}
            {visita.preferred_slot ? ` (${visita.preferred_slot})` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          {whatsapp ? (
            <Button asChild size="sm" variant="acento">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </Button>
          ) : null}
          {telefono ? (
            <Button asChild size="sm" variant="contorno">
              <a href={enlaceLlamada(telefono)!}>Llamar</a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((estado) => (
          <button
            key={estado}
            type="button"
            disabled={pendiente || estado === visita.status}
            onClick={() =>
              iniciar(async () => {
                const r = await cambiarEstadoVisita(visita.id, estado);
                setMensaje(r.error ?? "Visita actualizada");
              })
            }
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              estado === visita.status
                ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                : "border-[var(--borde)]"
            }`}
          >
            {ETIQUETA_ESTADO_VISITA[estado]}
          </button>
        ))}
      </div>

      {mensaje ? (
        <p role="status" className="text-xs text-[var(--exito)]">
          {mensaje}
        </p>
      ) : null}
    </article>
  );
}

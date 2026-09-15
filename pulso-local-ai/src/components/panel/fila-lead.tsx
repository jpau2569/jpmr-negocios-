"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/ui/icono";
import { anadirNota, asignarLead, cambiarEstadoLead } from "@/app/dashboard/leads/acciones";
import { ETIQUETA_ESTADO_LEAD, ETIQUETA_FUENTE, ETIQUETA_TIPO_LEAD } from "@/lib/etiquetas";
import { enlaceLlamada, enlaceWhatsapp, fechaHora } from "@/lib/formato";
import type { EstadoLead, Lead } from "@/types/dominio";

const ESTADOS: EstadoLead[] = ["nuevo", "contactado", "cualificado", "visita_agendada", "cerrado", "descartado"];

const TONO_ESTADO: Record<EstadoLead, "neutro" | "marca" | "exito" | "aviso" | "peligro"> = {
  nuevo: "aviso",
  contactado: "marca",
  cualificado: "marca",
  visita_agendada: "exito",
  cerrado: "exito",
  descartado: "neutro",
};

/**
 * Ficha de un contacto en el CRM.
 *
 * El botón de WhatsApp abre la conversación con el mensaje ya redactado, pero NO
 * lo envía: el envío automático de mensajes comerciales necesita consentimiento
 * específico y una decisión humana. Aquí se prepara el borrador y la persona
 * decide.
 */
export function FilaLead({
  lead,
  inmueble,
  equipo,
  whatsappNegocio,
}: {
  lead: Lead;
  inmueble: { title: string; slug: string } | null;
  equipo: { id: string; nombre: string }[];
  whatsappNegocio: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const borrador =
    `Hola ${lead.name.split(" ")[0]}, te escribo de ${whatsappNegocio}. ` +
    (inmueble
      ? `Vi que te interesó "${inmueble.title}". ¿Te viene bien que te llame hoy para contarte los detalles?`
      : "Recibí tu solicitud desde nuestra web. ¿Cuándo te viene bien que hablemos?");

  const whatsapp = enlaceWhatsapp(lead.phone, borrador);
  const llamada = enlaceLlamada(lead.phone);

  return (
    <article className="rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{lead.name}</h2>
            <Badge tono={TONO_ESTADO[lead.status]}>{ETIQUETA_ESTADO_LEAD[lead.status]}</Badge>
            <Badge tono="contorno">{ETIQUETA_TIPO_LEAD[lead.lead_type]}</Badge>
            <Badge tono="neutro">{ETIQUETA_FUENTE[lead.source]}</Badge>
            {lead.is_demo_data ? <Badge tono="aviso">Demo</Badge> : null}
          </div>
          <p className="text-xs text-[var(--texto-suave)]">
            {fechaHora(lead.created_at)}
            {lead.phone ? ` · ${lead.phone}` : ""}
            {lead.email ? ` · ${lead.email}` : ""}
            {inmueble ? ` · ${inmueble.title}` : ""}
          </p>
          {lead.message ? <p className="text-sm">{lead.message}</p> : null}
          {lead.preferred_contact_time ? (
            <p className="text-xs text-[var(--texto-suave)]">Prefiere: {lead.preferred_contact_time}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          {whatsapp ? (
            <Button asChild size="sm" variant="acento">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" title="Abre WhatsApp con el mensaje escrito; no se envía solo">
                <Icono nombre="whatsapp" />
                Borrador
              </a>
            </Button>
          ) : null}
          {llamada ? (
            <Button asChild size="sm" variant="contorno">
              <a href={llamada}>
                <Icono nombre="telefono" />
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="suave" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            {abierto ? "Cerrar" : "Gestionar"}
          </Button>
        </div>
      </div>

      {abierto ? (
        <div className="space-y-4 border-t border-[var(--borde)] p-4">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((estado) => (
              <button
                key={estado}
                type="button"
                disabled={pendiente || estado === lead.status}
                onClick={() =>
                  iniciar(async () => {
                    const r = await cambiarEstadoLead(lead.id, estado);
                    setMensaje(r.error ?? "Estado actualizado");
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  estado === lead.status
                    ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                    : "border-[var(--borde)]"
                }`}
              >
                {ETIQUETA_ESTADO_LEAD[estado]}
              </button>
            ))}
          </div>

          {equipo.length ? (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Asignado a
              <select
                defaultValue={lead.assigned_to ?? ""}
                onChange={(e) =>
                  iniciar(async () => {
                    const r = await asignarLead(lead.id, e.target.value || null);
                    setMensaje(r.error ?? "Asignación guardada");
                  })
                }
                className="min-h-10 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-2 text-sm"
              >
                <option value="">Sin asignar</option>
                {equipo.map((miembro) => (
                  <option key={miembro.id} value={miembro.id}>
                    {miembro.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <form
            action={(datos) =>
              iniciar(async () => {
                const r = await anadirNota(lead.id, datos);
                setMensaje(r.error ?? "Nota guardada");
              })
            }
            className="flex gap-2"
          >
            <input
              name="nota"
              placeholder="Nota interna: qué se habló, próxima acción…"
              className="min-h-11 flex-1 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
              required
              maxLength={2000}
            />
            <Button type="submit" size="sm" disabled={pendiente}>
              Guardar
            </Button>
          </form>

          <p className="text-xs text-[var(--texto-suave)]">
            Consentimiento: {fechaHora(lead.consented_at)} · texto legal {lead.legal_text_version}
          </p>

          {mensaje ? (
            <p role="status" className="text-xs font-medium text-[var(--exito)]">
              {mensaje}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

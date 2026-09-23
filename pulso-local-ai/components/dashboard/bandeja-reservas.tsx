"use client";

// ============================================================================
//  Bandeja de reservas y grupos
// ----------------------------------------------------------------------------
//  Lo que se hace aquí de verdad no es "gestionar reservas": es coger el
//  teléfono y llamar. Por eso el teléfono es lo más grande de cada fila y hay
//  un botón de WhatsApp con el mensaje ya escrito.
//
//  Los estados existen para que el del turno de tarde sepa a quién ya se ha
//  llamado. Nada más. Un flujo de estados bonito que nadie actualiza no sirve
//  para nada.
// ============================================================================

import { useState } from "react";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { fechaLarga } from "@/lib/utils";
import { whatsappLimpio } from "@/lib/schemas/formularios";

export type EstadoReserva = "pending" | "confirmed" | "cancelled" | "completed";

export interface FilaReserva {
  id: string;
  tipo: "reserva" | "grupo";
  name: string;
  phone: string;
  email: string | null;
  service_date: string | null;
  service_time: string | null;
  party_size: number | null;
  occasion?: string | null;
  celebration?: string | null;
  comments: string | null;
  allergies_note?: string | null;
  budget_hint?: string | null;
  needs_menu?: boolean;
  status: EstadoReserva;
  created_at: string;
}

const ESTADOS: { valor: EstadoReserva; texto: string; clase: string }[] = [
  { valor: "pending", texto: "Sin llamar", clase: "bg-amber-400/15 text-amber-200" },
  { valor: "confirmed", texto: "Confirmada", clase: "bg-emerald-500/15 text-emerald-300" },
  { valor: "cancelled", texto: "Cancelada", clase: "bg-red-500/15 text-red-300" },
  { valor: "completed", texto: "Ya vinieron", clase: "bg-white/10 text-white/60" },
];

const OCASIONES: Record<string, string> = {
  lunch: "Comida", dinner: "Cena", birthday: "Cumpleaños",
  group: "Grupo", event: "Evento", other: "",
};

export function BandejaReservas({
  slug, filas, negocio, hayBackend,
}: {
  slug: string;
  filas: FilaReserva[];
  negocio: string;
  hayBackend: boolean;
}) {
  const [estados, setEstados] = useState<Record<string, EstadoReserva>>(
    Object.fromEntries(filas.map((f) => [f.id, f.status])),
  );
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoReserva | "todas">("pending");

  async function cambiar(fila: FilaReserva, status: EstadoReserva) {
    const previo = estados[fila.id];
    setEstados((e) => ({ ...e, [fila.id]: status }));   // responde al momento
    setFallo(null);
    try {
      const r = await fetch("/api/panel/reserva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: fila.id, tipo: fila.tipo, status }),
      });
      const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !json.ok) throw new Error(json.error ?? "No se ha podido guardar.");
    } catch (e) {
      // Se deshace en pantalla: nada peor que creer que has confirmado una mesa.
      setEstados((es) => ({ ...es, [fila.id]: previo ?? fila.status }));
      setFallo(e instanceof Error ? e.message : "No se ha podido guardar.");
    }
  }

  const visibles = filtro === "todas" ? filas : filas.filter((f) => estados[f.id] === filtro);
  const sinLlamar = filas.filter((f) => estados[f.id] === "pending").length;

  return (
    <div className="space-y-4">
      {!hayBackend ? (
        <Aviso tono="error">
          <strong>Sin base de datos conectada.</strong> Lo que ves es un ejemplo para enseñar cómo
          quedará la bandeja. Las reservas de verdad necesitan Supabase.
        </Aviso>
      ) : null}

      {sinLlamar > 0 ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100">
          <strong className="text-amber-200">
            {sinLlamar === 1 ? "Queda 1 por llamar" : `Quedan ${sinLlamar} por llamar`}
          </strong>{" "}
          — ninguna reserva está confirmada hasta que habléis con el cliente.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {([["pending", "Sin llamar"], ["confirmed", "Confirmadas"], ["todas", "Todas"]] as const)
          .map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor as EstadoReserva | "todas")}
              className={`rounded-full border px-3.5 py-1.5 text-xs ${
                filtro === valor ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/55"
              }`}
            >
              {texto}
            </button>
          ))}
      </div>

      {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/45">
          {filtro === "pending" ? "Nada pendiente. Todo llamado." : "No hay nada aquí."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((f) => {
            const estado = estados[f.id] ?? f.status;
            const wasap = whatsappLimpio(f.phone);
            const mensaje = f.tipo === "grupo"
              ? `Hola ${f.name}, te escribo de ${negocio} por lo de la celebración que nos contaste.`
              : `Hola ${f.name}, te escribo de ${negocio} por tu reserva${f.service_date ? ` del ${fechaLarga(f.service_date)}` : ""}.`;

            return (
              <Tarjeta key={f.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{f.name}</h3>
                      {f.tipo === "grupo" ? (
                        <span className="rounded-full bg-[#8e2a33]/25 px-2 py-0.5 text-[0.65rem] font-semibold text-[#e08b95]">
                          Grupo
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                        ESTADOS.find((e) => e.valor === estado)?.clase ?? ""
                      }`}>
                        {ESTADOS.find((e) => e.valor === estado)?.texto}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-white/70">
                      {[
                        f.service_date ? fechaLarga(f.service_date) : "Sin fecha",
                        f.service_time?.slice(0, 5),
                        f.party_size ? `${f.party_size} personas` : null,
                        f.celebration || OCASIONES[f.occasion ?? ""] || null,
                      ].filter(Boolean).join(" · ")}
                    </p>

                    {f.allergies_note ? (
                      <p className="mt-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-200">
                        Alergias: {f.allergies_note}
                      </p>
                    ) : null}
                    {f.needs_menu ? (
                      <p className="mt-1 text-xs text-white/50">Quiere menú cerrado para el grupo</p>
                    ) : null}
                    {f.budget_hint ? (
                      <p className="mt-1 text-xs text-white/50">Presupuesto: {f.budget_hint}</p>
                    ) : null}
                    {f.comments ? (
                      <p className="mt-1.5 text-sm text-white/55">{f.comments}</p>
                    ) : null}
                  </div>

                  {/* El teléfono, lo más grande: es lo que se usa. */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <a href={`tel:${f.phone}`} className="text-lg font-semibold tabular-nums hover:underline">
                      {f.phone}
                    </a>
                    <div className="flex gap-1.5">
                      {wasap.length >= 9 ? (
                        <a
                          href={`https://wa.me/${wasap.startsWith("34") ? wasap : `34${wasap}`}?text=${encodeURIComponent(mensaje)}`}
                          target="_blank"
                          rel="noopener"
                          className="rounded-full bg-[#d4a03c] px-3 py-1.5 text-xs font-semibold text-[#17181b]"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {f.email ? (
                        <a href={`mailto:${f.email}`} className="rounded-full border border-white/15 px-3 py-1.5 text-xs">
                          Correo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/8 pt-3">
                  {ESTADOS.map((e) => (
                    <button
                      key={e.valor}
                      type="button"
                      onClick={() => cambiar(f, e.valor)}
                      disabled={estado === e.valor}
                      className={`rounded-full px-3 py-1.5 text-xs ${
                        estado === e.valor
                          ? `${e.clase} font-semibold`
                          : "border border-white/12 text-white/50 hover:text-white"
                      }`}
                    >
                      {e.texto}
                    </button>
                  ))}
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}
    </div>
  );
}

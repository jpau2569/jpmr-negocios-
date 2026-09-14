"use client";

// ============================================================================
//  Editor de carta
// ----------------------------------------------------------------------------
//  Su trabajo principal no es editar: es CONFIRMAR. La Taberna tiene 30 platos
//  sacados de una foto de su carta impresa, y hasta que el dueño los valide uno
//  a uno salen marcados como muestra en la web pública.
//
//  Por eso lo primero que se ve es cuántos quedan por confirmar, y por eso el
//  botón de confirmar está en cada fila y a un toque: el dueño va a repasar la
//  carta con el móvil en la mano, comparando con la de papel.
//
//  Se guarda plato a plato, en cuanto se toca. Un "guardar todo" al final es la
//  forma más segura de perder media hora de trabajo por un botón sin pulsar.
// ============================================================================

import { useState } from "react";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { euros } from "@/lib/utils";

export interface PlatoPanel {
  id: string;
  categoria: string;
  name: string;
  price_cents: number | null;
  status: string;
  is_demo: boolean;
}

export function EditorCarta({
  slug, platos: iniciales, hayBackend,
}: {
  slug: string;
  platos: PlatoPanel[];
  hayBackend: boolean;
}) {
  const [platos, setPlatos] = useState(iniciales);
  const [editando, setEditando] = useState<string | null>(null);
  const [precio, setPrecio] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [soloSinConfirmar, setSoloSinConfirmar] = useState(true);

  const sinConfirmar = platos.filter((p) => p.is_demo).length;

  async function guardar(id: string, cambios: Record<string, unknown>) {
    setOcupado(id);
    setFallo(null);
    const previo = platos;
    // Se pinta el cambio ya: el dueño está repasando 44 platos y esperar a cada
    // ida y vuelta haría el repaso insoportable.
    setPlatos((lista) => lista.map((p) => (p.id === id ? { ...p, ...cambios } as PlatoPanel : p)));
    try {
      const r = await fetch("/api/panel/plato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, ...cambios }),
      });
      const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !json.ok) throw new Error(json.error ?? "No se ha podido guardar.");
    } catch (e) {
      setPlatos(previo);
      setFallo(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      setOcupado(null);
      setEditando(null);
    }
  }

  const visibles = soloSinConfirmar ? platos.filter((p) => p.is_demo) : platos;
  const porCategoria = visibles.reduce((mapa, p) => {
    (mapa[p.categoria] ??= []).push(p);
    return mapa;
  }, {} as Record<string, PlatoPanel[]>);

  return (
    <div className="space-y-4">
      {!hayBackend ? (
        <Aviso tono="error">
          <strong>Sin base de datos conectada.</strong> Puedes ver cómo funciona, pero los cambios
          no se guardan. Conecta Supabase para confirmar la carta de verdad.
        </Aviso>
      ) : null}

      {sinConfirmar > 0 ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
          <p className="text-sm font-semibold text-amber-200">
            {sinConfirmar} {sinConfirmar === 1 ? "plato sin confirmar" : "platos sin confirmar"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
            Salen en la web marcados como muestra. Repásalos con la carta de papel delante y
            confirma cada uno: en cuanto lo hagas, deja de salir el aviso.
          </p>
        </div>
      ) : (
        <Aviso tono="ok">
          Toda la carta está confirmada. La web ya no avisa de datos sin verificar.
        </Aviso>
      )}

      {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={soloSinConfirmar}
          onChange={(e) => setSoloSinConfirmar(e.target.checked)}
          className="h-4.5 w-4.5 accent-[#d4a03c]"
        />
        <span className="text-white/60">Enseñar solo los que faltan por confirmar</span>
      </label>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/45">
          Nada pendiente aquí.
        </p>
      ) : (
        Object.entries(porCategoria).map(([categoria, lista]) => (
          <div key={categoria}>
            <h2 className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#d4a03c]">
              {categoria}
            </h2>
            <Tarjeta className="mt-2 divide-y divide-white/8">
              {lista.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      {p.is_demo ? (
                        <span className="text-amber-200/80">⚠ sin confirmar</span>
                      ) : (
                        <span className="text-emerald-300/70">✓ confirmado</span>
                      )}
                      {p.status === "sold_out" ? (
                        <span className="text-red-300/80">agotado hoy</span>
                      ) : null}
                    </div>
                  </div>

                  {editando === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={precio}
                        onChange={(e) => setPrecio(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") guardar(p.id, { price_cents: precio, is_demo: false });
                          if (e.key === "Escape") setEditando(null);
                        }}
                        placeholder="12,50"
                        className="w-24 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm outline-none focus:border-[#d4a03c]"
                      />
                      <button
                        type="button"
                        onClick={() => guardar(p.id, { price_cents: precio, is_demo: false })}
                        className="rounded-full bg-[#d4a03c] px-3 py-1.5 text-xs font-semibold text-[#17181b]"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(p.id);
                        setPrecio(p.price_cents != null ? String(p.price_cents / 100).replace(".", ",") : "");
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums hover:bg-white/5"
                      title="Cambiar el precio"
                    >
                      {euros(p.price_cents)}
                    </button>
                  )}

                  <div className="flex gap-1.5">
                    {p.is_demo ? (
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() => guardar(p.id, { is_demo: false })}
                        className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-50"
                      >
                        Está bien
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={ocupado === p.id}
                      onClick={() => guardar(p.id, {
                        status: p.status === "sold_out" ? "published" : "sold_out",
                      })}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/55 hover:text-white disabled:opacity-50"
                    >
                      {p.status === "sold_out" ? "Vuelve a haber" : "Se acabó"}
                    </button>
                  </div>
                </div>
              ))}
            </Tarjeta>
          </div>
        ))
      )}
    </div>
  );
}

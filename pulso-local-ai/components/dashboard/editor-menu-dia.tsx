"use client";

// ============================================================================
//  Editor del menú del día
// ----------------------------------------------------------------------------
//  Esto es lo ÚNICO que el negocio va a tocar todos los días, así que manda una
//  regla por encima de todas: que se pueda hacer en un minuto, de pie, con una
//  mano y con el móvil.
//
//  Por eso lo primero que se ve es un cuadro de texto donde pegar el menú tal
//  como ya lo tienen escrito —en la pizarra, en un WhatsApp al grupo del
//  personal, en una nota del móvil— y el programa lo reparte solo en primeros,
//  segundos y postres. Un formulario con quince campos no lo rellena nadie a
//  las once de la mañana con el género entrando por la puerta.
//
//  La lista se puede corregir a mano después, que para eso está.
// ============================================================================

import { useState } from "react";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton } from "@/components/ui/boton";
import { interpretarMenuPegado } from "@/lib/schemas/panel";
import { hoyISO, sumaDias, fechaLarga } from "@/lib/utils";

type Curso = "primero" | "segundo" | "postre" | "bebida";

interface PlatoEditable {
  course: Curso;
  name: string;
}

const CURSOS: { valor: Curso; texto: string }[] = [
  { valor: "primero", texto: "Primero" },
  { valor: "segundo", texto: "Segundo" },
  { valor: "postre", texto: "Postre" },
  { valor: "bebida", texto: "Bebida" },
];

const EJEMPLO = `Primeros
Fabada
Ensalada mixta
Sopa de marisco

Segundos
Merluza a la plancha
Entrecot con patatas

Postres
Arroz con leche
Flan de la casa`;

export function EditorMenuDia({
  slug,
  inicial,
  hayBackend,
}: {
  slug: string;
  inicial: {
    service_date: string;
    price_cents: number | null;
    includes_drink: boolean;
    notes: string | null;
    status: string;
    platos: { course: string; name: string }[];
  } | null;
  hayBackend: boolean;
}) {
  const [fecha, setFecha] = useState(inicial?.service_date ?? hoyISO());
  const [precio, setPrecio] = useState(
    inicial?.price_cents != null ? String(inicial.price_cents / 100).replace(".", ",") : "",
  );
  const [bebida, setBebida] = useState(inicial?.includes_drink ?? true);
  const [notas, setNotas] = useState(inicial?.notes ?? "");
  const [platos, setPlatos] = useState<PlatoEditable[]>(
    (inicial?.platos ?? []).map((p) => ({ course: p.course as Curso, name: p.name })),
  );
  const [pegado, setPegado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  function repartirPegado() {
    const leido = interpretarMenuPegado(pegado);
    if (leido.platos.length === 0) {
      setResultado({ ok: false, texto: "No he encontrado ningún plato en ese texto." });
      return;
    }
    setPlatos(leido.platos.map((p) => ({ course: p.course, name: p.name })));

    // Si el texto traía el precio y lo de la bebida, se rellenan solos: son dos
    // campos menos que tocar con el género entrando por la puerta.
    const extras: string[] = [];
    if (leido.precioCents !== null) {
      setPrecio(String(leido.precioCents / 100).replace(".", ","));
      extras.push("precio");
    }
    if (leido.bebidaIncluida) {
      setBebida(true);
      extras.push("bebida incluida");
    }

    setPegado("");
    setResultado({
      ok: true,
      texto: `${leido.platos.length} platos repartidos`
        + (extras.length ? `, y he cogido el ${extras.join(" y la ")}` : "")
        + ". Revísalo abajo.",
    });
  }

  async function guardar(status: "draft" | "published" | "sold_out") {
    setGuardando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/panel/menu-dia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          service_date: fecha,
          price_cents: precio,
          includes_drink: bebida,
          notes: notas,
          status,
          platos: platos.filter((p) => p.name.trim()),
        }),
      });
      const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !json.ok) {
        setResultado({ ok: false, texto: json.error ?? "No se ha podido guardar." });
        return;
      }
      setResultado({
        ok: true,
        texto: status === "published"
          ? "Publicado. Ya se ve en la web."
          : status === "sold_out"
            ? "Marcado como agotado."
            : "Guardado como borrador: todavía no se ve en la web.",
      });
    } catch {
      setResultado({ ok: false, texto: "No hay conexión." });
    } finally {
      setGuardando(false);
    }
  }

  const porCurso = (curso: Curso) =>
    platos.map((p, i) => ({ ...p, i })).filter((p) => p.course === curso);

  return (
    <div className="space-y-5">
      {!hayBackend ? (
        <Aviso tono="error">
          <strong>Sin base de datos conectada.</strong> Puedes trastear con el editor, pero al
          guardar no se queda nada. Conecta Supabase para usarlo de verdad.
        </Aviso>
      ) : null}

      {/* --- Pegar el menú tal cual --- */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Pega el menú de hoy</h2>
        <p className="mt-1 text-sm text-white/55">
          Cópialo del WhatsApp o de la nota donde ya lo tengas escrito. Yo lo reparto en primeros,
          segundos y postres, y luego lo revisas.
        </p>
        <textarea
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          rows={6}
          placeholder={EJEMPLO}
          className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base outline-none focus:border-[#d4a03c]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Boton type="button" variante="plano" onClick={repartirPegado} disabled={!pegado.trim()}>
            Repartir en platos
          </Boton>
          {platos.length > 0 ? (
            <Boton type="button" variante="fantasma" onClick={() => setPlatos([])}>
              Vaciar la lista
            </Boton>
          ) : null}
        </div>
      </Tarjeta>

      {/* --- La lista, para corregir --- */}
      <Tarjeta className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Los platos</h2>
          <span className="text-xs text-white/45">{platos.length} en total</span>
        </div>

        {platos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
            Todavía no hay platos. Pega el menú arriba o añádelos uno a uno.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {CURSOS.map(({ valor, texto }) => {
              const lista = porCurso(valor);
              if (lista.length === 0) return null;
              return (
                <div key={valor}>
                  <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#d4a03c]">
                    {texto}s
                  </h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {lista.map((p) => (
                      <li key={p.i} className="flex items-center gap-2">
                        <input
                          value={p.name}
                          onChange={(e) => {
                            const copia = [...platos];
                            copia[p.i] = { ...copia[p.i]!, name: e.target.value };
                            setPlatos(copia);
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-sm outline-none focus:border-[#d4a03c]"
                        />
                        <select
                          value={p.course}
                          onChange={(e) => {
                            const copia = [...platos];
                            copia[p.i] = { ...copia[p.i]!, course: e.target.value as Curso };
                            setPlatos(copia);
                          }}
                          aria-label="Cambiar de apartado"
                          className="shrink-0 rounded-lg border border-white/12 bg-black/25 px-2 py-2 text-xs"
                        >
                          {CURSOS.map((c) => (
                            <option key={c.valor} value={c.valor}>{c.texto}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setPlatos(platos.filter((_, i) => i !== p.i))}
                          aria-label={`Quitar ${p.name}`}
                          className="shrink-0 rounded-lg px-2.5 py-2 text-white/40 hover:bg-white/5 hover:text-white"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {CURSOS.slice(0, 3).map((c) => (
            <Boton
              key={c.valor}
              type="button"
              variante="fantasma"
              tamano="sm"
              onClick={() => setPlatos([...platos, { course: c.valor, name: "" }])}
            >
              + {c.texto}
            </Boton>
          ))}
        </div>
      </Tarjeta>

      {/* --- Día, precio y condiciones --- */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">El día y el precio</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span>¿Para qué día?</span>
            <input
              type="date"
              value={fecha}
              min={sumaDias(hoyISO(), -7)}
              max={sumaDias(hoyISO(), 90)}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base outline-none focus:border-[#d4a03c]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span>Precio</span>
            <input
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="14,50"
              className="rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base outline-none focus:border-[#d4a03c]"
            />
          </label>
          <label className="flex items-center gap-2.5 pt-6 text-sm">
            <input
              type="checkbox"
              checked={bebida}
              onChange={(e) => setBebida(e.target.checked)}
              className="h-5 w-5 accent-[#d4a03c]"
            />
            <span>Incluye bebida</span>
          </label>
        </div>

        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span>Observaciones</span>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Solo de lunes a viernes · No se sirve en terraza"
            className="rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base outline-none focus:border-[#d4a03c]"
          />
        </label>

        <p className="mt-3 text-xs capitalize text-white/45">{fechaLarga(fecha)}</p>
      </Tarjeta>

      {resultado ? (
        <Aviso tono={resultado.ok ? "ok" : "error"}>{resultado.texto}</Aviso>
      ) : null}

      {/* --- Guardar ---
          Publicar es el botón grande porque es lo que se hace el 95% de las
          veces. El borrador sirve para dejar los menús de la semana cargados el
          domingo y que cada uno salga solo en su día. */}
      <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-[#0e0f11]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Boton
            type="button"
            onClick={() => guardar("published")}
            disabled={guardando || platos.length === 0}
          >
            {guardando ? "Guardando…" : "Publicar el menú"}
          </Boton>
          <Boton type="button" variante="contorno" onClick={() => guardar("draft")} disabled={guardando}>
            Guardar sin publicar
          </Boton>
          <Boton type="button" variante="fantasma" onClick={() => guardar("sold_out")} disabled={guardando}>
            Se ha agotado
          </Boton>
        </div>
      </div>
    </div>
  );
}

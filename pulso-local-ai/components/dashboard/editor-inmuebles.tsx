"use client";

// ============================================================================
//  Panel de inmuebles
// ----------------------------------------------------------------------------
//  Tres cosas, por orden de uso real:
//
//  1. SINCRONIZAR. Un botón. Lee la web de la agencia y trae lo que haya. Lo
//     que se ve después no es "hecho": es qué ha cambiado exactamente, para
//     que quien lo pulsa sepa si esperaba eso.
//
//  2. DAR DE ALTA A MANO. Es el boca a boca, y es la mitad del negocio. Solo
//     se piden referencia y título: la agencia acaba de salir de ver el piso y
//     está en la calle con el móvil. Pedirle superficie, planta y certificado
//     en ese momento significa que no lo mete nunca.
//
//  3. LO QUE VA COJO. Los inmuebles sin etiqueta energética, que es
//     obligatoria en los anuncios. Una lista, no un aviso que se ignora.
// ============================================================================

import { useState } from "react";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, Seleccion, Casilla } from "@/components/ui/campo";
import { euros } from "@/lib/utils";
import {
  ESTADO_OPERACION_ES, TIPOS_INMUEBLE_ES,
  type EstadoOperacion, type TipoInmueble, type VisibilidadInmueble,
} from "@/types/negocio";

export interface InmueblePanel {
  id: string;
  reference: string;
  title: string;
  operation: "venta" | "alquiler";
  kind: TipoInmueble;
  price_cents: number | null;
  municipality: string | null;
  visibility: VisibilidadInmueble;
  deal_state: EstadoOperacion;
  status: "draft" | "published" | "sold_out";
  energy_status: "disponible" | "en_tramite" | "exento" | "pendiente";
  source: "web" | "manual" | "portal";
  private_token: string | null;
  /** Trozo de URL del inmueble: hace falta para su QR y su cartel. */
  slug: string;
  /** Token de su QR, tal y como está en la base. null = todavía no tiene. */
  qrToken: string | null;
}

interface Props {
  slug: string;
  negocio: string;
  web: string | null;
  inmuebles: InmueblePanel[];
  hayBackend: boolean;
}

interface ResultadoSync {
  ok: boolean;
  resumen?: string;
  error?: string;
  errores?: string[];
}

const VISIBILIDAD: { valor: VisibilidadInmueble; texto: string; pista: string }[] = [
  { valor: "borrador", texto: "Borrador", pista: "Solo lo ves tú" },
  { valor: "publico", texto: "Público", pista: "Sale en la cartera y en Google" },
  {
    valor: "enlace_privado",
    texto: "Enlace privado",
    pista: "No sale en ningún listado ni en Google. Se manda por WhatsApp a quien tú decidas.",
  },
];

export function EditorInmuebles({ slug, negocio, web, inmuebles, hayBackend }: Props) {
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [alta, setAlta] = useState<{ ok: boolean; texto: string; enlace?: string } | null>(null);

  const [form, setForm] = useState({
    reference: "",
    title: "",
    operation: "venta",
    kind: "piso",
    price: "",
    price_on_request: false,
    surface_built_m2: "",
    rooms: "",
    municipality: "",
    description: "",
    visibility: "enlace_privado" as VisibilidadInmueble,
  });

  const cambiar = (campo: string, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function sincronizar() {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/panel/sincronizar-cartera", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      setResultado(await r.json());
    } catch {
      setResultado({ ok: false, error: "No se ha podido conectar con el servidor." });
    } finally {
      setSincronizando(false);
    }
  }

  async function darDeAlta(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setAlta(null);
    try {
      const r = await fetch("/api/panel/inmueble", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          reference: form.reference,
          title: form.title,
          operation: form.operation,
          kind: form.kind,
          price_on_request: form.price_on_request,
          price_cents: form.price_on_request || !form.price ? null : Number(form.price),
          surface_built_m2: form.surface_built_m2 ? Number(form.surface_built_m2) : null,
          rooms: form.rooms ? Number(form.rooms) : null,
          municipality: form.municipality || undefined,
          description: form.description || undefined,
          visibility: form.visibility,
          // Un alta de boca a boca nace publicada dentro de su visibilidad:
          // si es de enlace privado, "publicada" significa que el enlace abre.
          status: "published",
          energy_status: "pendiente",
        }),
      });
      const datos = await r.json();
      if (!datos.ok) {
        setAlta({ ok: false, texto: datos.error ?? "No se ha podido guardar." });
        return;
      }
      setAlta({
        ok: true,
        texto: `«${form.title}» dado de alta.`,
        ...(datos.enlacePrivado ? { enlace: datos.enlacePrivado } : {}),
      });
      setForm((f) => ({ ...f, reference: "", title: "", price: "", surface_built_m2: "", rooms: "", description: "" }));
    } catch {
      setAlta({ ok: false, texto: "No se ha podido conectar con el servidor." });
    } finally {
      setGuardando(false);
    }
  }

  const sinCertificado = inmuebles.filter((i) => i.energy_status === "pendiente");
  const deLaWeb = inmuebles.filter((i) => i.source === "web");
  const aMano = inmuebles.filter((i) => i.source !== "web");

  return (
    <div className="flex flex-col gap-6">
      {/* --- 1. Sincronizar ------------------------------------------------ */}
      <Tarjeta className="p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Traer la cartera de la web</h2>
        <p className="mt-1.5 text-sm text-white/60">
          {web
            ? <>Lee <span className="text-white/80">{web.replace(/^https?:\/\//, "")}</span> y trae los inmuebles publicados.</>
            : "Este negocio no tiene web configurada, así que no hay de dónde leer."}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          Lo que des de alta a mano <strong className="text-white/70">nunca</strong> se toca.
          Lo que desaparezca de la web se despublica, no se borra. Y si no se
          puede leer la web, no se cambia nada.
        </p>

        <div className="mt-4">
          <Boton type="button" onClick={sincronizar} disabled={sincronizando || !web || !hayBackend}>
            {sincronizando ? "Leyendo la web…" : "Sincronizar ahora"}
          </Boton>
        </div>

        {!hayBackend ? (
          <Aviso tono="error" className="mt-3">
            No hay base de datos conectada: esto es una demostración y la
            sincronización no puede guardar nada.
          </Aviso>
        ) : null}

        {resultado ? (
          <Aviso tono={resultado.ok ? "ok" : "error"} className="mt-3">
            {resultado.ok ? resultado.resumen : resultado.error}
            {resultado.errores?.length ? (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {resultado.errores.map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : null}
          </Aviso>
        ) : null}
      </Tarjeta>

      {/* --- 2. Alta a mano (el boca a boca) -------------------------------- */}
      <Tarjeta className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Dar de alta a mano
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Para lo que no está en la web: la captación de boca a boca.
            </p>
          </div>
          <Boton type="button" variante="contorno" onClick={() => setAbierto((a) => !a)}>
            {abierto ? "Cerrar" : "Añadir inmueble"}
          </Boton>
        </div>

        {abierto ? (
          <form onSubmit={darDeAlta} className="mt-5 flex flex-col gap-4" noValidate>
            <p className="text-xs leading-relaxed text-white/45">
              Solo hacen falta la referencia y el título. Lo demás se rellena
              cuando puedas: un inmueble a medias vale mucho más que ninguno.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Referencia" id="in-ref" requerido>
                <Entrada id="in-ref" value={form.reference} placeholder="PIS0231"
                  onChange={(e) => cambiar("reference", e.target.value)} required />
              </Campo>
              <Campo etiqueta="Título" id="in-titulo" requerido>
                <Entrada id="in-titulo" value={form.title} placeholder="Piso en el centro de Oviedo"
                  onChange={(e) => cambiar("title", e.target.value)} required />
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Operación" id="in-op">
                <Seleccion id="in-op" value={form.operation}
                  onChange={(e) => cambiar("operation", e.target.value)}>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                </Seleccion>
              </Campo>
              <Campo etiqueta="Tipo" id="in-tipo">
                <Seleccion id="in-tipo" value={form.kind}
                  onChange={(e) => cambiar("kind", e.target.value)}>
                  {Object.entries(TIPOS_INMUEBLE_ES).map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </Seleccion>
              </Campo>
              <Campo etiqueta="Precio (€)" id="in-precio"
                pista={form.price_on_request ? "A consultar" : "Sin decimales"}>
                <Entrada id="in-precio" type="number" inputMode="numeric" value={form.price}
                  disabled={form.price_on_request} placeholder="165000"
                  onChange={(e) => cambiar("price", e.target.value)} />
              </Campo>
            </div>

            <Casilla id="in-consultar" checked={form.price_on_request}
              onChange={(e) => cambiar("price_on_request", e.target.checked)}>
              Precio a consultar (no publicar importe)
            </Casilla>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Superficie (m²)" id="in-m2">
                <Entrada id="in-m2" type="number" inputMode="numeric" value={form.surface_built_m2}
                  onChange={(e) => cambiar("surface_built_m2", e.target.value)} />
              </Campo>
              <Campo etiqueta="Habitaciones" id="in-hab">
                <Entrada id="in-hab" type="number" inputMode="numeric" value={form.rooms}
                  onChange={(e) => cambiar("rooms", e.target.value)} />
              </Campo>
              <Campo etiqueta="Municipio" id="in-muni">
                <Entrada id="in-muni" value={form.municipality} placeholder="Oviedo"
                  onChange={(e) => cambiar("municipality", e.target.value)} />
              </Campo>
            </div>

            <Campo etiqueta="Descripción" id="in-desc">
              <AreaTexto id="in-desc" value={form.description}
                onChange={(e) => cambiar("description", e.target.value)} />
            </Campo>

            <Campo etiqueta="¿Quién puede verlo?" id="in-vis"
              pista={VISIBILIDAD.find((v) => v.valor === form.visibility)?.pista}>
              <Seleccion id="in-vis" value={form.visibility}
                onChange={(e) => cambiar("visibility", e.target.value)}>
                {VISIBILIDAD.map((v) => (
                  <option key={v.valor} value={v.valor}>{v.texto}</option>
                ))}
              </Seleccion>
            </Campo>

            <Aviso className="text-xs">
              La etiqueta energética queda como <strong>pendiente</strong>. Es
              obligatoria en los anuncios (RD 390/2021), así que la ficha lo
              dirá hasta que la cargues.
            </Aviso>

            {alta ? (
              <Aviso tono={alta.ok ? "ok" : "error"}>
                {alta.texto}
                {alta.enlace ? (
                  <>
                    <br />
                    <span className="text-xs">
                      Enlace privado para mandar por WhatsApp:{" "}
                      <code className="break-all text-white/80">{alta.enlace}</code>
                    </span>
                  </>
                ) : null}
              </Aviso>
            ) : null}

            <Boton type="submit" disabled={guardando || !hayBackend}>
              {guardando ? "Guardando…" : "Dar de alta"}
            </Boton>
          </form>
        ) : null}
      </Tarjeta>

      {/* --- 3. Lo que va cojo --------------------------------------------- */}
      {sinCertificado.length > 0 ? (
        <Tarjeta className="p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Sin etiqueta energética ({sinCertificado.length})
          </h2>
          <p className="mt-1.5 text-sm text-white/60">
            El RD 390/2021 obliga a mostrarla en cualquier anuncio de venta o
            alquiler. Mientras falte, la ficha lo dice en voz alta.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {sinCertificado.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-2 text-white/70">
                <span className="text-white/40">{i.reference}</span>
                <span>{i.title}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {/* --- La cartera ----------------------------------------------------- */}
      <Tarjeta className="p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Cartera de {negocio}
        </h2>
        <p className="mt-1.5 text-sm text-white/60">
          {inmuebles.length === 0
            ? "Todavía no hay ningún inmueble. Pulsa «Sincronizar ahora» o da uno de alta a mano."
            : `${inmuebles.length} en total · ${deLaWeb.length} de la web · ${aMano.length} a mano`}
        </p>

        {inmuebles.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="pb-2 pr-3">Ref.</th>
                  <th className="pb-2 pr-3">Inmueble</th>
                  <th className="pb-2 pr-3">Precio</th>
                  <th className="pb-2 pr-3">Estado</th>
                  <th className="pb-2 pr-3">Quién lo ve</th>
                  <th className="pb-2">Su cartel</th>
                </tr>
              </thead>
              <tbody>
                {inmuebles.map((i) => (
                  <tr key={i.id} className="border-t border-white/10">
                    <td className="py-2.5 pr-3 text-white/40">{i.reference}</td>
                    <td className="py-2.5 pr-3">
                      {i.title}
                      <span className="ml-2 text-xs text-white/35">
                        {TIPOS_INMUEBLE_ES[i.kind]}
                        {i.municipality ? ` · ${i.municipality}` : ""}
                        {i.source !== "web" ? " · a mano" : ""}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {i.price_cents === null ? "Consultar" : euros(i.price_cents)}
                    </td>
                    <td className="py-2.5 pr-3">{ESTADO_OPERACION_ES[i.deal_state]}</td>
                    <td className="py-2.5 pr-3">
                      {i.visibility === "publico"
                        ? "Todos"
                        : i.visibility === "enlace_privado"
                          ? "Solo con el enlace"
                          : "Solo tú"}
                      {i.status !== "published" ? " · sin publicar" : ""}
                    </td>
                    <td className="py-2.5">
                      {/* El cartel A4 solo existe para los públicos: el de un
                          inmueble de enlace privado, colgado en el escaparate,
                          dejaría de ser privado en el acto. */}
                      {i.visibility === "publico" && i.status === "published" && i.qrToken ? (
                        <a
                          href={`/api/qr/${encodeURIComponent(i.qrToken)}?negocio=${slug}&destino=property&inmueble=${encodeURIComponent(i.slug)}&formato=a4`}
                          target="_blank"
                          rel="noopener"
                          className="text-[#d4a03c] underline"
                        >
                          A4 escaparate
                        </a>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Tarjeta>
    </div>
  );
}

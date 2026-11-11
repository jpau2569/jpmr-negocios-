"use client";
import { useState } from "react";
import { Aviso, ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { cambiosDeOrden, mover, parseOrden } from "@/lib/destacados";
import { mensajeError, supabase } from "@/lib/supabase";
import { slugDesdeTitulo } from "@/lib/texto";
import type { Categoria } from "@/lib/tipos";
import { SLUG_RE } from "@/lib/validacion";

interface Borrador { id: string | null; nombre: string; slug: string; descripcion: string; imagen_portada: string; orden: string; activa: boolean }
const VACIA: Borrador = { id: null, nombre: "", slug: "", descripcion: "", imagen_portada: "", orden: "", activa: true };

export default function Categorias() {
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const { data, error: e } = await supabase().from("categorias").select("*").order("orden").order("nombre");
    if (e) throw e;
    return (data ?? []) as Categoria[];
  }, []);
  const [ed, setEd] = useState<Borrador | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function abrir(c: Categoria | null) {
    setErrs({}); setAviso(null);
    setEd(c ? { id: c.id, nombre: c.nombre, slug: c.slug, descripcion: c.descripcion ?? "", imagen_portada: c.imagen_portada ?? "", orden: String(c.orden), activa: c.activa }
      : { ...VACIA, orden: String((datos?.length ?? 0) + 1) });
  }

  async function guardar() {
    if (!ed) return;
    const e: Record<string, string> = {};
    if (!ed.nombre.trim()) e.nombre = "El nombre es obligatorio.";
    if (!SLUG_RE.test(ed.slug.trim())) e.slug = "Solo minúsculas, números y guiones simples.";
    if (ed.imagen_portada.trim() && !/^https:\/\//.test(ed.imagen_portada.trim())) e.imagen_portada = "Debe ser una URL https.";
    const orden = parseOrden(ed.orden);
    if (orden === null) e.orden = "Entero igual o mayor que 0.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setOcupado(true); setAviso(null);
    const fila = { nombre: ed.nombre.trim(), slug: ed.slug.trim(), descripcion: ed.descripcion.trim() || null, imagen_portada: ed.imagen_portada.trim() || null, orden, activa: ed.activa };
    const q = supabase().from("categorias");
    const { error: err } = ed.id ? await q.update(fila).eq("id", ed.id) : await q.insert(fila);
    setOcupado(false);
    if (err) { setAviso({ tipo: "error", t: /duplicate|unique/i.test(err.message) ? "Ya existe una categoría con ese slug." : mensajeError(err) }); return; }
    setEd(null); setAviso({ tipo: "ok", t: "Categoría guardada." }); recargar();
  }

  async function borrar(c: Categoria) {
    if (!window.confirm(`¿Eliminar la categoría «${c.nombre}»? Los wallpapers que la usan se quedarán sin categoría.`)) return;
    const { error: err } = await supabase().from("categorias").delete().eq("id", c.id);
    if (err) setAviso({ tipo: "error", t: mensajeError(err) }); else { setAviso({ tipo: "ok", t: "Categoría eliminada." }); recargar(); }
  }

  async function subirBajar(i: number, dir: -1 | 1) {
    if (!datos) return;
    const nueva = mover(datos, i, dir);
    const cambios = cambiosDeOrden(datos.map((c) => ({ id: c.id, orden: c.orden })), nueva);
    setOcupado(true);
    for (const c of cambios) {
      const { error: err } = await supabase().from("categorias").update({ orden: c.orden }).eq("id", c.id);
      if (err) { setAviso({ tipo: "error", t: mensajeError(err) }); break; }
    }
    setOcupado(false); recargar();
  }

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setEd((b) => (b ? { ...b, [k]: v } : b));

  return (
    <>
      <Titulo acciones={<button type="button" className="btn btn-primario" onClick={() => abrir(null)}>Nueva categoría</button>}>Categorías</Titulo>
      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}

      {ed && (
        <form noValidate className="tarjeta mb-4 grid gap-3 md:grid-cols-2" aria-labelledby="h-cat" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <h2 id="h-cat" className="text-lg font-bold md:col-span-2">{ed.id ? "Editar categoría" : "Nueva categoría"}</h2>
          <div>
            <label className="etiqueta" htmlFor="c-nombre">Nombre *</label>
            <input id="c-nombre" className="campo" value={ed.nombre} aria-invalid={errs.nombre ? true : undefined}
              onChange={(e) => { set("nombre", e.target.value); if (!ed.id) set("slug", slugDesdeTitulo(e.target.value)); }} />
            {errs.nombre && <p role="alert" className="error-campo">{errs.nombre}</p>}
          </div>
          <div>
            <label className="etiqueta" htmlFor="c-slug">Slug *</label>
            <input id="c-slug" className="campo" value={ed.slug} aria-invalid={errs.slug ? true : undefined} onChange={(e) => set("slug", e.target.value)} />
            {errs.slug && <p role="alert" className="error-campo">{errs.slug}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="etiqueta" htmlFor="c-desc">Descripción</label>
            <textarea id="c-desc" className="campo" rows={2} value={ed.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="c-img">Imagen de portada (URL https)</label>
            <input id="c-img" className="campo" value={ed.imagen_portada} aria-invalid={errs.imagen_portada ? true : undefined} onChange={(e) => set("imagen_portada", e.target.value)} />
            {errs.imagen_portada && <p role="alert" className="error-campo">{errs.imagen_portada}</p>}
          </div>
          <div>
            <label className="etiqueta" htmlFor="c-orden">Orden</label>
            <input id="c-orden" className="campo" inputMode="numeric" value={ed.orden} aria-invalid={errs.orden ? true : undefined} onChange={(e) => set("orden", e.target.value)} />
            {errs.orden && <p role="alert" className="error-campo">{errs.orden}</p>}
          </div>
          <div className="flex items-center gap-3 min-h-11">
            <input id="c-activa" type="checkbox" className="w-6 h-6 accent-azul" checked={ed.activa} onChange={(e) => set("activa", e.target.checked)} />
            <label htmlFor="c-activa" className="font-semibold">Activa (visible en la app)</label>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn btn-primario" disabled={ocupado}>Guardar</button>
            <button type="button" className="btn" onClick={() => setEd(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando && !datos ? <Skeleton /> : error ? <ErrorCaja mensaje={error} reintentar={recargar} /> :
        !datos?.length ? <Vacio>No hay categorías todavía.</Vacio> : (
          <div className="tarjeta p-0 overflow-x-auto">
            <table className="tabla">
              <caption className="sr-only">Categorías</caption>
              <thead><tr><th scope="col">Orden</th><th scope="col">Nombre</th><th scope="col">Activa</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {datos.map((c, i) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="w-6 text-center">{c.orden}</span>
                        <button type="button" className="btn" aria-label={`Subir ${c.nombre}`} disabled={ocupado || i === 0} onClick={() => void subirBajar(i, -1)}>↑</button>
                        <button type="button" className="btn" aria-label={`Bajar ${c.nombre}`} disabled={ocupado || i === datos.length - 1} onClick={() => void subirBajar(i, 1)}>↓</button>
                      </div>
                    </td>
                    <td><div className="font-semibold">{c.nombre}</div><div className="text-gris text-sm break-all">{c.slug}</div></td>
                    <td>{c.activa ? "Sí" : "No"}</td>
                    <td>
                      <div className="flex gap-2">
                        <button type="button" className="btn" onClick={() => abrir(c)}>Editar<span className="sr-only"> {c.nombre}</span></button>
                        <button type="button" className="btn btn-peligro" onClick={() => void borrar(c)}>Eliminar<span className="sr-only"> {c.nombre}</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { supabase } from "@/lib/supabase";
import { ESTADOS, ETIQUETA_ESTADO, type Categoria, type Estado, type Wallpaper } from "@/lib/tipos";
import { normalizarTexto } from "@/lib/texto";

type Fila = Pick<Wallpaper, "id" | "slug" | "titulo" | "estado_publicacion" | "es_premium" | "categoria_id" | "updated_at" | "destacado_orden" | "fecha_publicacion">;
type Orden = "recientes" | "titulo" | "estado";

export default function Lista() {
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const sb = supabase();
    const [w, c] = await Promise.all([
      sb.from("wallpapers").select("id,slug,titulo,estado_publicacion,es_premium,categoria_id,updated_at,destacado_orden,fecha_publicacion").order("updated_at", { ascending: false }).limit(2000),
      sb.from("categorias").select("id,nombre").order("orden"),
    ]);
    if (w.error) throw w.error;
    if (c.error) throw c.error;
    return { filas: (w.data ?? []) as Fila[], cats: (c.data ?? []) as Pick<Categoria, "id" | "nombre">[] };
  }, []);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"" | Estado>("");
  const [cat, setCat] = useState("");
  const [premium, setPremium] = useState<"" | "si" | "no">("");
  const [orden, setOrden] = useState<Orden>("recientes");

  const visibles = useMemo(() => {
    if (!datos) return [];
    const t = normalizarTexto(q);
    const r = datos.filas.filter((f) =>
      (!t || normalizarTexto(f.titulo).includes(t) || f.slug.includes(t)) &&
      (!estado || f.estado_publicacion === estado) &&
      (!cat || (cat === "_sin" ? !f.categoria_id : f.categoria_id === cat)) &&
      (!premium || (premium === "si") === f.es_premium));
    if (orden === "titulo") r.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    else if (orden === "estado") r.sort((a, b) => ESTADOS.indexOf(a.estado_publicacion) - ESTADOS.indexOf(b.estado_publicacion));
    else r.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return r;
  }, [datos, q, estado, cat, premium, orden]);

  const nombreCat = (id: string | null) => datos?.cats.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <>
      <Titulo acciones={<Link href="/wallpapers/nuevo" className="btn btn-primario">Nuevo wallpaper</Link>}>Wallpapers</Titulo>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        <div className="lg:col-span-2">
          <label className="etiqueta" htmlFor="q">Buscar</label>
          <input id="q" type="search" className="campo" placeholder="Título o slug" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="f-estado">Estado</label>
          <select id="f-estado" className="campo" value={estado} onChange={(e) => setEstado(e.target.value as Estado | "")}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{ETIQUETA_ESTADO[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="f-cat">Categoría</label>
          <select id="f-cat" className="campo" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas</option>
            <option value="_sin">Sin categoría</option>
            {datos?.cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="f-prem">Premium</label>
          <select id="f-prem" className="campo" value={premium} onChange={(e) => setPremium(e.target.value as "" | "si" | "no")}>
            <option value="">Todos</option><option value="si">Solo premium</option><option value="no">Solo gratis</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="f-orden">Ordenar por</label>
          <select id="f-orden" className="campo" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="recientes">Más recientes</option><option value="titulo">Título (A-Z)</option><option value="estado">Estado</option>
          </select>
        </div>
      </form>

      {cargando && !datos ? <Skeleton /> : error ? <ErrorCaja mensaje={error} reintentar={recargar} /> :
        visibles.length === 0 ? <Vacio>{datos?.filas.length ? "Ningún wallpaper coincide con los filtros." : "Todavía no hay wallpapers. Crea el primero."}</Vacio> : (
          <div className="tarjeta p-0 overflow-x-auto">
            <table className="tabla">
              <caption className="sr-only">Lista de wallpapers</caption>
              <thead><tr><th scope="col">Título</th><th scope="col">Estado</th><th scope="col" className="hidden md:table-cell">Categoría</th><th scope="col">Premium</th><th scope="col" className="hidden md:table-cell">Actualizado</th></tr></thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id}>
                    <td className="min-w-40">
                      <Link href={`/wallpapers/${f.id}`} className="text-turquesa underline font-semibold inline-flex items-center min-h-11">{f.titulo}</Link>
                      <div className="text-gris text-sm break-all">{f.slug}</div>
                    </td>
                    <td><span className="chip">{ETIQUETA_ESTADO[f.estado_publicacion]}</span></td>
                    <td className="hidden md:table-cell">{nombreCat(f.categoria_id)}</td>
                    <td>{f.es_premium ? "Sí" : "No"}</td>
                    <td className="hidden md:table-cell whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString("es-ES")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-gris text-sm" aria-live="polite">{visibles.length} de {datos?.filas.length} wallpapers</p>
          </div>
        )}
    </>
  );
}

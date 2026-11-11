"use client";
import { useState } from "react";
import { Aviso, ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { cambiosDeOrden, mover, ordenarDestacados } from "@/lib/destacados";
import { mensajeError, supabase } from "@/lib/supabase";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/tipos";

interface Fila { id: string; titulo: string; slug: string; estado_publicacion: Estado; destacado_orden: number | null }

export default function Destacados() {
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const { data, error: e } = await supabase().from("wallpapers").select("id,titulo,slug,estado_publicacion,destacado_orden").order("titulo").limit(2000);
    if (e) throw e;
    const todas = (data ?? []) as Fila[];
    return { dest: ordenarDestacados(todas), otros: todas.filter((f) => f.destacado_orden === null) };
  }, []);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState("");

  async function aplicar(cambios: { id: string; orden: number | null }[]) {
    setOcupado(true); setAviso(null);
    for (const c of cambios) {
      const { error: err } = await supabase().from("wallpapers").update({ destacado_orden: c.orden }).eq("id", c.id);
      if (err) { setAviso({ tipo: "error", t: mensajeError(err) }); break; }
    }
    setOcupado(false); recargar();
  }

  const mueve = (i: number, d: -1 | 1) => {
    if (!datos) return;
    void aplicar(cambiosDeOrden(datos.dest.map((f) => ({ id: f.id, orden: f.destacado_orden })), mover(datos.dest, i, d)));
  };
  const quitar = (id: string) => {
    if (!datos) return;
    const resto = datos.dest.filter((f) => f.id !== id);
    void aplicar([{ id, orden: null }, ...cambiosDeOrden(datos.dest.map((f) => ({ id: f.id, orden: f.destacado_orden })).filter((f) => f.id !== id), resto)]);
  };
  const anadir = () => {
    if (!nuevo || !datos) return;
    void aplicar([{ id: nuevo, orden: datos.dest.length + 1 }]);
    setNuevo("");
  };

  return (
    <>
      <Titulo>Destacados</Titulo>
      <p className="text-gris mb-4">Orden en que aparecen los wallpapers destacados en la app. Solo se ven los publicados.</p>
      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}
      {cargando && !datos ? <Skeleton /> : error ? <ErrorCaja mensaje={error} reintentar={recargar} /> : datos && (
        <>
          {datos.dest.length === 0 ? <Vacio>No hay wallpapers destacados.</Vacio> : (
            <ol className="space-y-2 mb-6">
              {datos.dest.map((f, i) => (
                <li key={f.id} className="tarjeta flex flex-wrap items-center gap-2">
                  <span className="w-8 text-center font-bold text-turquesa" aria-label={`Posición ${i + 1}`}>{i + 1}</span>
                  <div className="flex-1 min-w-40"><div className="font-semibold">{f.titulo}</div><div className="text-gris text-sm">{ETIQUETA_ESTADO[f.estado_publicacion]}</div></div>
                  <button type="button" className="btn" aria-label={`Subir ${f.titulo}`} disabled={ocupado || i === 0} onClick={() => mueve(i, -1)}>↑</button>
                  <button type="button" className="btn" aria-label={`Bajar ${f.titulo}`} disabled={ocupado || i === datos.dest.length - 1} onClick={() => mueve(i, 1)}>↓</button>
                  <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => quitar(f.id)}>Quitar<span className="sr-only"> {f.titulo}</span></button>
                </li>
              ))}
            </ol>
          )}
          <div className="tarjeta flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label className="etiqueta" htmlFor="d-nuevo">Añadir a destacados</label>
              <select id="d-nuevo" className="campo" value={nuevo} onChange={(e) => setNuevo(e.target.value)}>
                <option value="">Elige un wallpaper…</option>
                {datos.otros.map((o) => <option key={o.id} value={o.id}>{o.titulo} ({ETIQUETA_ESTADO[o.estado_publicacion]})</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-primario" disabled={!nuevo || ocupado} onClick={anadir}>Añadir al final</button>
          </div>
        </>
      )}
    </>
  );
}

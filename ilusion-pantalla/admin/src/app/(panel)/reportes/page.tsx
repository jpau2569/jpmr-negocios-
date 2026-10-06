"use client";
import { useState } from "react";
import { Aviso, ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Estado } from "@/lib/tipos";

type EstadoRep = "abierto" | "revisado" | "descartado" | "retirado";
const ESTADOS_REP: EstadoRep[] = ["abierto", "revisado", "descartado", "retirado"];
const MOTIVO: Record<string, string> = { copyright: "Copyright", inapropiado: "Inapropiado", calidad: "Calidad", otro: "Otro" };
interface Rep {
  id: string; wallpaper_id: string; motivo: string; comentario: string | null; estado: EstadoRep; created_at: string;
  wallpapers: { id: string; titulo: string; slug: string; estado_publicacion: Estado } | null;
}

export default function Reportes() {
  const [filtro, setFiltro] = useState<"" | EstadoRep>("abierto");
  const { datos, error, cargando, recargar } = useCarga(async () => {
    let q = supabase().from("reportes_contenido").select("id,wallpaper_id,motivo,comentario,estado,created_at,wallpapers(id,titulo,slug,estado_publicacion)").order("created_at", { ascending: false }).limit(500);
    if (filtro) q = q.eq("estado", filtro);
    const { data, error: e } = await q;
    if (e) throw e;
    return (data ?? []) as unknown as Rep[];
  }, [filtro]);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function cambiar(r: Rep, nuevo: EstadoRep) {
    if (nuevo === r.estado) return;
    setAviso(null);
    const pausar = nuevo === "retirado" && r.wallpapers?.estado_publicacion === "publicado";
    if (nuevo === "retirado" && !window.confirm(
      `¿Marcar como RETIRADO?${pausar ? ` El wallpaper «${r.wallpapers?.titulo}» pasará a «pausado» y dejará de verse en la app.` : " El wallpaper no está publicado, así que no cambia de estado."}`)) return;
    setOcupado(r.id);
    try {
      if (pausar) {
        const { error: e1 } = await supabase().from("wallpapers").update({ estado_publicacion: "pausado" }).eq("id", r.wallpaper_id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase().from("reportes_contenido").update({ estado: nuevo }).eq("id", r.id);
      if (e2) throw e2;
      setAviso({ tipo: "ok", t: pausar ? "Reporte retirado y wallpaper pausado." : "Reporte actualizado." });
      recargar();
    } catch (x) { setAviso({ tipo: "error", t: mensajeError(x) }); }
    finally { setOcupado(null); }
  }

  return (
    <>
      <Titulo>Reportes de contenido</Titulo>
      <div className="mb-4 max-w-xs">
        <label className="etiqueta" htmlFor="r-estado">Estado</label>
        <select id="r-estado" className="campo" value={filtro} onChange={(e) => setFiltro(e.target.value as "" | EstadoRep)}>
          <option value="">Todos</option>{ESTADOS_REP.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}
      {cargando && !datos ? <Skeleton /> : error ? <ErrorCaja mensaje={error} reintentar={recargar} /> :
        !datos?.length ? <Vacio>No hay reportes con este filtro.</Vacio> : (
          <ul className="space-y-3">
            {datos.map((r) => (
              <li key={r.id} className="tarjeta">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.wallpapers?.titulo ?? "Wallpaper eliminado"}</p>
                    <p className="text-gris text-sm">{MOTIVO[r.motivo] ?? r.motivo} · {new Date(r.created_at).toLocaleString("es-ES")}{r.wallpapers ? ` · ${r.wallpapers.estado_publicacion}` : ""}</p>
                  </div>
                  <div>
                    <label className="etiqueta" htmlFor={`rs-${r.id}`}>Estado del reporte</label>
                    <select id={`rs-${r.id}`} className="campo" value={r.estado} disabled={ocupado === r.id} onChange={(e) => void cambiar(r, e.target.value as EstadoRep)}>
                      {ESTADOS_REP.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {r.comentario && <p className="mt-2 whitespace-pre-wrap break-words">{r.comentario}</p>}
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

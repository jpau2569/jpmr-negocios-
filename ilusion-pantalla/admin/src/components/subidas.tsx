"use client";
import { useState } from "react";
import { CALIDADES, CODECS, COLUMNA_IMAGEN, validarArchivo } from "@/lib/archivo";
import { sha256Hex, subirArchivo } from "@/lib/subida";
import { mensajeError, supabase } from "@/lib/supabase";
import { esUrlHttps, formatoBytes } from "@/lib/texto";
import type { Archivo, Calidad, Codec, Wallpaper } from "@/lib/tipos";
import { Aviso } from "./estados";

type Img = "thumb" | "poster" | "preview";
const IMAGENES: { tipo: Img; nombre: string; ayuda: string }[] = [
  { tipo: "thumb", nombre: "Miniatura (thumbnail)", ayuda: "Recomendado WebP ≤ 60 KB." },
  { tipo: "poster", nombre: "Póster", ayuda: "Recomendado WebP ≤ 250 KB." },
  { tipo: "preview", nombre: "Preview (opcional)", ayuda: "Imagen de baja resolución." },
];
const NOMBRE_CALIDAD: Record<Calidad, string> = { q720: "720p", q1080: "1080p", q1440: "1440p", q2160: "2160p (4K)" };

export function Subidas({ w, archivos, alCambiar }: {
  w: Pick<Wallpaper, "id" | "slug" | "url_thumbnail" | "url_poster" | "url_preview">;
  archivos: Archivo[];
  alCambiar: () => void;
}) {
  return (
    <div className="space-y-4">
      <ImagenesSub w={w} alCambiar={alCambiar} />
      <VideosSub w={w} archivos={archivos} alCambiar={alCambiar} />
    </div>
  );
}

function ImagenesSub({ w, alCambiar }: { w: Parameters<typeof Subidas>[0]["w"]; alCambiar: () => void }) {
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState<Img | null>(null);
  const [pct, setPct] = useState(0);

  async function subir(tipo: Img, f: File | undefined) {
    if (!f) return;
    setMsg(null);
    const v = validarArchivo({ slug: w.slug, tipo, mime: f.type, bytes: f.size });
    if (!v.ok) { setMsg({ tipo: "error", t: v.error }); return; }
    setOcupado(tipo); setPct(0);
    try {
      const r = await subirArchivo({ slug: w.slug, tipo, archivo: f, alProgreso: setPct });
      if (!esUrlHttps(r.url_publica)) throw new Error("El servidor no devolvió una URL pública https para la imagen.");
      const { error } = await supabase().from("wallpapers").update({ [COLUMNA_IMAGEN[tipo]]: r.url_publica }).eq("id", w.id);
      if (error) throw error;
      setMsg({ tipo: "ok", t: "Imagen subida y guardada." });
      alCambiar();
    } catch (e) { setMsg({ tipo: "error", t: mensajeError(e) }); }
    finally { setOcupado(null); }
  }

  return (
    <section className="tarjeta" aria-labelledby="h-img">
      <h2 id="h-img" className="text-lg font-bold mb-3">Imágenes</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {IMAGENES.map((im) => {
          const url = w[COLUMNA_IMAGEN[im.tipo]];
          return (
            <div key={im.tipo}>
              <label className="etiqueta" htmlFor={`img-${im.tipo}`}>{im.nombre}</label>
              {esUrlHttps(url)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt={`Vista previa: ${im.nombre}`} className="w-full h-32 object-cover rounded-xl border border-borde mb-2" />
                : <p className="text-gris text-sm mb-2">Sin imagen todavía.</p>}
              <input id={`img-${im.tipo}`} type="file" accept="image/jpeg,image/png,image/webp" className="campo" disabled={ocupado !== null}
                onChange={(e) => { void subir(im.tipo, e.target.files?.[0]); e.target.value = ""; }} />
              <p className="ayuda">{im.ayuda} Máx. 5 MB.</p>
              {ocupado === im.tipo && <p role="status" className="ayuda">Subiendo… {pct} %</p>}
            </div>
          );
        })}
      </div>
      {msg && <div className="mt-3"><Aviso tipo={msg.tipo}>{msg.t}</Aviso></div>}
    </section>
  );
}

function VideosSub({ w, archivos, alCambiar }: { w: Parameters<typeof Subidas>[0]["w"]; archivos: Archivo[]; alCambiar: () => void }) {
  const [calidad, setCalidad] = useState<Calidad>("q1080");
  const [codec, setCodec] = useState<Codec>("h264");
  const [fps, setFps] = useState("30");
  const [bitrate, setBitrate] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [clave, setClave] = useState(0); // para vaciar el input de archivo

  async function subir() {
    setMsg(null);
    if (!archivo) { setMsg({ tipo: "error", t: "Elige un archivo MP4." }); return; }
    const v = validarArchivo({ slug: w.slug, tipo: "video", calidad, codec, mime: archivo.type, bytes: archivo.size });
    if (!v.ok) { setMsg({ tipo: "error", t: v.error }); return; }
    const kbps = bitrate.trim() === "" ? null : Number(bitrate);
    if (kbps !== null && !(Number.isInteger(kbps) && kbps > 0)) { setMsg({ tipo: "error", t: "El bitrate debe ser un entero mayor que 0 (kbps) o estar vacío." }); return; }
    const previo = archivos.find((a) => a.calidad === calidad && a.codec === codec);
    if (previo && !window.confirm(`Ya existe un vídeo ${NOMBRE_CALIDAD[calidad]} ${codec.toUpperCase()}. Se reemplazará el archivo. ¿Continuar?`)) return;
    try {
      setFase("Calculando huella SHA-256…");
      const sha = await sha256Hex(archivo);
      setFase("Subiendo…"); setPct(0);
      const r = await subirArchivo({ slug: w.slug, tipo: "video", calidad, codec, archivo, alProgreso: setPct });
      setFase("Registrando…");
      const fila = {
        wallpaper_id: w.id, calidad, codec, fps: Number(fps), bitrate_kbps: kbps, tamano_bytes: archivo.size,
        storage_bucket: r.bucket || "ilusion-videos", storage_path: r.clave, sha256: sha,
      };
      const q = supabase().from("wallpaper_archivos");
      const { error } = previo ? await q.update(fila).eq("id", previo.id) : await q.insert(fila);
      if (error) throw error;
      setMsg({ tipo: "ok", t: previo ? "Vídeo reemplazado." : "Vídeo subido y registrado." });
      setArchivo(null); setClave((c) => c + 1);
      alCambiar();
    } catch (e) { setMsg({ tipo: "error", t: mensajeError(e) }); }
    finally { setFase(null); }
  }

  async function quitar(a: Archivo) {
    if (!window.confirm(`¿Quitar el registro del vídeo ${NOMBRE_CALIDAD[a.calidad]} ${a.codec.toUpperCase()}? El archivo en el almacenamiento no se borra desde el panel.`)) return;
    const { error } = await supabase().from("wallpaper_archivos").delete().eq("id", a.id);
    if (error) setMsg({ tipo: "error", t: mensajeError(error) }); else alCambiar();
  }

  return (
    <section className="tarjeta" aria-labelledby="h-vid">
      <h2 id="h-vid" className="text-lg font-bold mb-3">Archivos de vídeo</h2>
      {archivos.length === 0 ? <p className="text-gris mb-3">Todavía no hay vídeos.</p> : (
        <div className="overflow-x-auto mb-4">
          <table className="tabla">
            <caption className="sr-only">Vídeos subidos</caption>
            <thead><tr><th scope="col">Calidad</th><th scope="col">Códec</th><th scope="col">FPS</th><th scope="col">Tamaño</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {archivos.map((a) => (
                <tr key={a.id}>
                  <td>{NOMBRE_CALIDAD[a.calidad]}</td><td>{a.codec.toUpperCase()}</td><td>{a.fps}</td><td>{formatoBytes(a.tamano_bytes)}</td>
                  <td><button type="button" className="btn btn-peligro" onClick={() => void quitar(a)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" disabled={fase !== null}>
        <legend className="etiqueta">Subir vídeo (MP4, máx. 150 MB)</legend>
        <div><label className="etiqueta" htmlFor="v-cal">Calidad</label>
          <select id="v-cal" className="campo" value={calidad} onChange={(e) => setCalidad(e.target.value as Calidad)}>{CALIDADES.map((c) => <option key={c} value={c}>{NOMBRE_CALIDAD[c]}</option>)}</select></div>
        <div><label className="etiqueta" htmlFor="v-cod">Códec</label>
          <select id="v-cod" className="campo" value={codec} onChange={(e) => setCodec(e.target.value as Codec)}>{CODECS.map((c) => <option key={c} value={c}>{c === "h264" ? "H.264" : "HEVC (H.265)"}</option>)}</select></div>
        <div><label className="etiqueta" htmlFor="v-fps">FPS del vídeo</label>
          <select id="v-fps" className="campo" value={fps} onChange={(e) => setFps(e.target.value)}>{[24, 30, 60].map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
        <div><label className="etiqueta" htmlFor="v-br">Bitrate (kbps, opcional)</label>
          <input id="v-br" inputMode="numeric" className="campo" value={bitrate} onChange={(e) => setBitrate(e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-4"><label className="etiqueta" htmlFor="v-file">Archivo</label>
          <input key={clave} id="v-file" type="file" accept="video/mp4" className="campo" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} /></div>
      </fieldset>
      <button type="button" className="btn btn-primario mt-3" disabled={fase !== null || !archivo} onClick={() => void subir()}>Subir vídeo</button>
      {fase && <p role="status" className="ayuda mt-2">{fase}{fase === "Subiendo…" ? ` ${pct} %` : ""}</p>}
      {msg && <div className="mt-3"><Aviso tipo={msg.tipo}>{msg.t}</Aviso></div>}
    </section>
  );
}

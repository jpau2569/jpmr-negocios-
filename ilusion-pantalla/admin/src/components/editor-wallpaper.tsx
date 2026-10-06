"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { faltaParaPublicar, fechaAlPublicar } from "@/lib/publicar";
import { mensajeError, supabase } from "@/lib/supabase";
import { slugDesdeTitulo } from "@/lib/texto";
import { ETIQUETA_ESTADO, type Archivo, type Categoria, type Estado, type Wallpaper } from "@/lib/tipos";
import {
  FORM_VACIO, ORIENTACIONES, PERFILES, TIPOS, filaAForm, formAFila, transicionesPermitidas, validarWallpaper,
  type Errores, type FormWallpaper,
} from "@/lib/validacion";
import { Aviso, ErrorCaja, Skeleton, Titulo, useCarga } from "./estados";
import { Subidas } from "./subidas";

function Campo({ id, etiqueta, error, ayuda, children }: { id: string; etiqueta: string; error?: string; ayuda?: string; children: ReactNode }) {
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda && <p className="ayuda" id={`${id}-ayuda`}>{ayuda}</p>}
      {error && <p className="error-campo" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

export function EditorWallpaper({ id }: { id: string | null }) {
  const router = useRouter();
  const nuevo = id === null;
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const sb = supabase();
    const cats = await sb.from("categorias").select("id,nombre,slug,activa").order("orden");
    if (cats.error) throw cats.error;
    if (!id) return { w: null as Wallpaper | null, archivos: [] as Archivo[], cats: (cats.data ?? []) as Categoria[] };
    const [w, a] = await Promise.all([
      sb.from("wallpapers").select("*").eq("id", id).maybeSingle(),
      sb.from("wallpaper_archivos").select("*").eq("wallpaper_id", id).order("calidad"),
    ]);
    if (w.error) throw w.error;
    if (!w.data) throw new Error("No existe ese wallpaper.");
    if (a.error) throw a.error;
    return { w: w.data as Wallpaper, archivos: (a.data ?? []) as Archivo[], cats: (cats.data ?? []) as Categoria[] };
  }, [id]);

  const [form, setForm] = useState<FormWallpaper>(FORM_VACIO);
  const [base, setBase] = useState<string>(JSON.stringify(FORM_VACIO));
  const [errores, setErrores] = useState<Errores>({});
  const [slugManual, setSlugManual] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cargado = useRef<string | null>(null);
  const sucioRef = useRef(false);

  const sucio = JSON.stringify(form) !== base;
  useEffect(() => { sucioRef.current = sucio; });

  // Rellena el formulario solo cuando llegan datos nuevos del servidor (no pisa lo escrito al subir un archivo).
  useEffect(() => {
    if (!datos?.w) return;
    const firma = datos.w.id + datos.w.updated_at;
    if (cargado.current === firma) return;
    const primera = cargado.current === null;
    cargado.current = firma;
    if (!primera && sucioRef.current) return; // hay ediciones sin guardar: no se pisan
    const f = filaAForm(datos.w);
    setForm(f); setBase(JSON.stringify(f)); setErrores({});
  }, [datos]);

  const w = datos?.w ?? null;
  const archivos = datos?.archivos ?? [];
  const falta = w ? faltaParaPublicar(w, archivos) : [];

  function set<K extends keyof FormWallpaper>(k: K, v: FormWallpaper[K]) {
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (k === "titulo" && nuevo && !slugManual) n.slug = slugDesdeTitulo(String(v));
      return n;
    });
  }
  const att = (k: keyof FormWallpaper) => ({
    id: `f-${k}`, "aria-invalid": errores[k] ? (true as const) : undefined,
    "aria-describedby": [errores[k] ? `f-${k}-error` : "", `f-${k}-ayuda`].filter(Boolean).join(" ") || undefined,
  });

  async function guardar() {
    setAviso(null);
    const e = validarWallpaper(form);
    setErrores(e);
    const primero = Object.keys(e)[0];
    if (primero) { document.getElementById(`f-${primero}`)?.focus(); setAviso({ tipo: "error", t: "Revisa los campos marcados." }); return; }
    setOcupado(true);
    try {
      const fila = formAFila(form);
      if (nuevo) {
        const { data, error: err } = await supabase().from("wallpapers").insert({ ...fila, estado_publicacion: "borrador" }).select("id").single();
        if (err) throw err;
        router.replace(`/wallpapers/${data.id}`);
        return;
      }
      const { error: err } = await supabase().from("wallpapers").update(fila).eq("id", id);
      if (err) throw err;
      setBase(JSON.stringify(form));
      setAviso({ tipo: "ok", t: "Cambios guardados." });
      recargar();
    } catch (x) {
      const m = mensajeError(x);
      setAviso({ tipo: "error", t: /duplicate|unique|23505/i.test(m) ? "Ya existe un wallpaper con ese slug." : m });
    } finally { setOcupado(false); }
  }

  async function cambiarEstado(a: Estado) {
    if (!w) return;
    setAviso(null);
    if (a === "publicado") {
      if (sucio) { setAviso({ tipo: "error", t: "Guarda los cambios antes de publicar." }); return; }
      if (falta.length) { setAviso({ tipo: "error", t: "No se puede publicar: falta algo (ver lista)." }); return; }
    }
    if (a === "archivado" && !window.confirm(`¿Archivar «${w.titulo}»? Dejará de verse en la app.`)) return;
    setOcupado(true);
    try {
      const cambios: { estado_publicacion: Estado; fecha_publicacion?: string } = { estado_publicacion: a };
      if (a === "publicado") cambios.fecha_publicacion = fechaAlPublicar(w.fecha_publicacion);
      const { error: err } = await supabase().from("wallpapers").update(cambios).eq("id", w.id);
      if (err) throw err;
      setAviso({ tipo: "ok", t: `Estado: ${ETIQUETA_ESTADO[a]}.` });
      recargar();
    } catch (x) { setAviso({ tipo: "error", t: mensajeError(x) }); }
    finally { setOcupado(false); }
  }

  async function eliminar() {
    if (!w) return;
    if (!window.confirm(`¿ELIMINAR «${w.titulo}» para siempre? Se borrarán también sus registros de vídeo. Los archivos del almacenamiento no se borran desde el panel.`)) return;
    setOcupado(true);
    const { error: err } = await supabase().from("wallpapers").delete().eq("id", w.id);
    if (err) { setAviso({ tipo: "error", t: mensajeError(err) }); setOcupado(false); return; }
    router.replace("/wallpapers");
  }

  if (cargando && !datos) return <Skeleton />;
  if (error) return <ErrorCaja mensaje={error} reintentar={recargar} />;

  return (
    <>
      <Titulo acciones={<Link href="/wallpapers" className="btn">Volver a la lista</Link>}>{nuevo ? "Nuevo wallpaper" : `Editar: ${w?.titulo ?? ""}`}</Titulo>
      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}

      <div className="space-y-4">
        {w && (
          <section className="tarjeta" aria-labelledby="h-estado">
            <h2 id="h-estado" className="text-lg font-bold mb-2">Estado: <span className="chip">{ETIQUETA_ESTADO[w.estado_publicacion]}</span></h2>
            {w.estado_publicacion !== "publicado" && (
              <div className="mb-3">
                <p className="font-semibold">Para publicar:</p>
                {falta.length === 0 ? <p className="text-ok">Todo listo para publicar.</p> : (
                  <ul className="list-disc pl-6 text-aviso">{falta.map((f) => <li key={f}>Falta: {f}</li>)}</ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {transicionesPermitidas(w.estado_publicacion).map((a) => (
                <button key={a} type="button" disabled={ocupado || (a === "publicado" && (falta.length > 0 || sucio))}
                  className={`btn ${a === "publicado" ? "btn-primario" : a === "archivado" ? "btn-peligro" : ""}`} onClick={() => void cambiarEstado(a)}>
                  {a === "publicado" ? "Publicar" : a === "revision" ? "Enviar a revisión" : a === "archivado" ? "Archivar" : a === "pausado" ? "Pausar" : "Pasar a borrador"}
                </button>
              ))}
            </div>
            {sucio && <p className="ayuda">Hay cambios sin guardar: guárdalos antes de publicar.</p>}
          </section>
        )}

        <form className="tarjeta space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void guardar(); }} aria-labelledby="h-datos">
          <h2 id="h-datos" className="text-lg font-bold">Datos</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="f-titulo" etiqueta="Título *" error={errores.titulo} ayuda="Entre 3 y 80 caracteres.">
              <input {...att("titulo")} className="campo" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={120} />
            </Campo>
            <Campo id="f-slug" etiqueta="Slug *" error={errores.slug} ayuda={nuevo ? "Se genera del título; puedes cambiarlo. No se podrá cambiar después (da nombre a los archivos subidos)." : "El slug no se puede cambiar: da nombre a los archivos ya subidos."}>
              <input {...att("slug")} className="campo" value={form.slug} readOnly={!nuevo} aria-readonly={!nuevo} onChange={(e) => { setSlugManual(true); set("slug", e.target.value); }} />
            </Campo>
            <div className="md:col-span-2">
              <Campo id="f-descripcion" etiqueta="Descripción">
                <textarea {...att("descripcion")} className="campo" rows={3} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
              </Campo>
            </div>
            <Campo id="f-categoria_id" etiqueta="Categoría">
              <select {...att("categoria_id")} className="campo" value={form.categoria_id} onChange={(e) => set("categoria_id", e.target.value)}>
                <option value="">Sin categoría</option>
                {datos?.cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? "" : " (inactiva)"}</option>)}
              </select>
            </Campo>
            <Campo id="f-etiquetas" etiqueta="Etiquetas" ayuda="Separadas por comas.">
              <input {...att("etiquetas")} className="campo" value={form.etiquetas} onChange={(e) => set("etiquetas", e.target.value)} />
            </Campo>
            <Campo id="f-tipo" etiqueta="Tipo">
              <select {...att("tipo")} className="campo" value={form.tipo} onChange={(e) => set("tipo", e.target.value as FormWallpaper["tipo"])}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo id="f-orientacion" etiqueta="Orientación">
              <select {...att("orientacion")} className="campo" value={form.orientacion} onChange={(e) => set("orientacion", e.target.value as FormWallpaper["orientacion"])}>{ORIENTACIONES.map((t) => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo id="f-duracion_s" etiqueta="Duración (s)" error={errores.duracion_s} ayuda="Entre 3 y 60.">
              <input {...att("duracion_s")} className="campo" inputMode="decimal" value={form.duracion_s} onChange={(e) => set("duracion_s", e.target.value)} />
            </Campo>
            <Campo id="f-resolucion" etiqueta="Resolución" error={errores.resolucion} ayuda="Ej.: 1080x1920.">
              <input {...att("resolucion")} className="campo" value={form.resolucion} onChange={(e) => set("resolucion", e.target.value)} />
            </Campo>
            <Campo id="f-fps_recomendado" etiqueta="FPS recomendado" error={errores.fps_recomendado}>
              <select {...att("fps_recomendado")} className="campo" value={form.fps_recomendado} onChange={(e) => set("fps_recomendado", e.target.value)}>
                <option value="">Sin indicar</option><option>24</option><option>30</option><option>60</option>
              </select>
            </Campo>
            <Campo id="f-perfil_rendimiento" etiqueta="Perfil de rendimiento">
              <select {...att("perfil_rendimiento")} className="campo" value={form.perfil_rendimiento} onChange={(e) => set("perfil_rendimiento", e.target.value as FormWallpaper["perfil_rendimiento"])}>{PERFILES.map((t) => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo id="f-tamano_archivo_bytes" etiqueta="Tamaño de archivo (bytes)" error={errores.tamano_archivo_bytes}>
              <input {...att("tamano_archivo_bytes")} className="campo" inputMode="numeric" value={form.tamano_archivo_bytes} onChange={(e) => set("tamano_archivo_bytes", e.target.value)} />
            </Campo>
            <Campo id="f-consumo_estimado" etiqueta="Consumo estimado">
              <select {...att("consumo_estimado")} className="campo" value={form.consumo_estimado} onChange={(e) => set("consumo_estimado", e.target.value)}>
                <option value="">Sin indicar</option><option value="bajo">bajo</option><option value="medio">medio</option><option value="alto">alto</option>
              </select>
            </Campo>
            <Campo id="f-color_dominante" etiqueta="Color dominante" error={errores.color_dominante} ayuda="Formato #RRGGBB.">
              <div className="flex gap-2">
                <input {...att("color_dominante")} className="campo" value={form.color_dominante} onChange={(e) => set("color_dominante", e.target.value)} />
                <span aria-hidden="true" className="w-11 h-11 rounded-xl border border-borde shrink-0" style={{ background: /^#[0-9A-Fa-f]{6}$/.test(form.color_dominante) ? form.color_dominante : "transparent" }} />
              </div>
            </Campo>
            <Campo id="f-estilo" etiqueta="Estilo">
              <input {...att("estilo")} className="campo" value={form.estilo} onChange={(e) => set("estilo", e.target.value)} />
            </Campo>
            <Campo id="f-licencia" etiqueta="Licencia *" error={errores.licencia} ayuda="«original-propia» o la licencia de terceros (exige créditos para publicar).">
              <input {...att("licencia")} className="campo" value={form.licencia} onChange={(e) => set("licencia", e.target.value)} />
            </Campo>
            <Campo id="f-creditos" etiqueta="Créditos">
              <input {...att("creditos")} className="campo" value={form.creditos} onChange={(e) => set("creditos", e.target.value)} />
            </Campo>
            <div className="flex items-center gap-3 min-h-11">
              <input id="f-es_premium" type="checkbox" className="w-6 h-6 accent-azul" checked={form.es_premium} onChange={(e) => set("es_premium", e.target.checked)} />
              <label htmlFor="f-es_premium" className="font-semibold">Contenido premium</label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primario" disabled={ocupado || (!nuevo && !sucio)}>{ocupado ? "Guardando…" : nuevo ? "Crear borrador" : "Guardar cambios"}</button>
            {!nuevo && <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => void eliminar()}>Eliminar wallpaper</button>}
          </div>
        </form>

        {w ? <Subidas w={w} archivos={archivos} alCambiar={recargar} /> : (
          <p className="tarjeta text-gris">Crea el borrador para poder subir imágenes y vídeos.</p>
        )}
      </div>
    </>
  );
}

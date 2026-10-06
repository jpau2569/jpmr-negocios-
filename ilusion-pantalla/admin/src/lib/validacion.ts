// Espejo de los CHECK de la tabla wallpapers (supabase/migrations/0001_core.sql).
// Si cambias un CHECK allí, cámbialo aquí y en validacion.test.ts.
import type { Estado, Orientacion, Perfil, Tipo } from "./tipos";

/** Formulario: todo texto salvo los booleanos (así se validan también entradas absurdas). */
export interface FormWallpaper {
  slug: string;
  titulo: string;
  descripcion: string;
  categoria_id: string;
  etiquetas: string; // separadas por comas
  tipo: Tipo;
  orientacion: Orientacion;
  duracion_s: string;
  resolucion: string;
  fps_recomendado: string;
  perfil_rendimiento: Perfil;
  tamano_archivo_bytes: string;
  consumo_estimado: string;
  color_dominante: string;
  estilo: string;
  es_premium: boolean;
  licencia: string;
  creditos: string;
}

export type Errores = Partial<Record<keyof FormWallpaper, string>>;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESOLUCION_RE = /^[0-9]{3,4}x[0-9]{3,4}$/;
export const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
export const FPS_VALIDOS = [24, 30, 60];
export const TIPOS: Tipo[] = ["video", "imagen", "parallax", "escena3d"];
export const ORIENTACIONES: Orientacion[] = ["vertical", "horizontal", "cuadrado"];
export const PERFILES: Perfil[] = ["ahorro", "estandar", "alta", "ultra"];

export const FORM_VACIO: FormWallpaper = {
  slug: "", titulo: "", descripcion: "", categoria_id: "", etiquetas: "", tipo: "video",
  orientacion: "vertical", duracion_s: "", resolucion: "", fps_recomendado: "",
  perfil_rendimiento: "estandar", tamano_archivo_bytes: "", consumo_estimado: "",
  color_dominante: "", estilo: "", es_premium: false, licencia: "original-propia", creditos: "",
};

/** Acepta «3,5» y «3.5». Devuelve null si está vacío y NaN si no es un número. */
export function parseNumero(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export function parseEtiquetas(s: string): string[] {
  const vistas = new Set<string>();
  for (const e of s.split(",")) {
    const t = e.trim().toLowerCase();
    if (t) vistas.add(t);
  }
  return [...vistas];
}

export function validarWallpaper(f: FormWallpaper): Errores {
  const e: Errores = {};
  const slug = f.slug.trim();
  if (!SLUG_RE.test(slug)) e.slug = "Solo minúsculas, números y guiones simples (p. ej. bosque-de-luciernagas).";
  else if (slug.length > 60) e.slug = "Máximo 60 caracteres.";

  const largo = [...f.titulo.trim()].length;
  if (largo < 3 || largo > 80) e.titulo = "El título debe tener entre 3 y 80 caracteres.";

  const dur = parseNumero(f.duracion_s);
  if (dur !== null && (Number.isNaN(dur) || dur < 3 || dur > 60)) e.duracion_s = "La duración debe estar entre 3 y 60 segundos.";

  const res = f.resolucion.trim();
  if (res && !RESOLUCION_RE.test(res)) e.resolucion = "Formato AnchoxAlto, p. ej. 1080x1920.";

  const fps = parseNumero(f.fps_recomendado);
  if (fps !== null && (Number.isNaN(fps) || !FPS_VALIDOS.includes(fps))) e.fps_recomendado = "Solo 24, 30 o 60 fps.";

  const tam = parseNumero(f.tamano_archivo_bytes);
  if (tam !== null && (Number.isNaN(tam) || tam <= 0 || !Number.isInteger(tam))) e.tamano_archivo_bytes = "Entero mayor que 0 (bytes).";

  const col = f.color_dominante.trim();
  if (col && !COLOR_RE.test(col)) e.color_dominante = "Formato #RRGGBB, p. ej. #4D7CFE.";

  if (!f.licencia.trim()) e.licencia = "La licencia no puede estar vacía.";
  return e;
}

/** Convierte el formulario (ya validado) en la fila que se envía a Supabase. */
export function formAFila(f: FormWallpaper) {
  const vacioANull = (s: string) => (s.trim() === "" ? null : s.trim());
  const n = (s: string) => {
    const v = parseNumero(s);
    return v === null || Number.isNaN(v) ? null : v;
  };
  return {
    slug: f.slug.trim(),
    titulo: f.titulo.trim(),
    descripcion: vacioANull(f.descripcion),
    categoria_id: f.categoria_id || null,
    etiquetas: parseEtiquetas(f.etiquetas),
    tipo: f.tipo,
    orientacion: f.orientacion,
    duracion_s: n(f.duracion_s),
    resolucion: vacioANull(f.resolucion),
    fps_recomendado: n(f.fps_recomendado),
    perfil_rendimiento: f.perfil_rendimiento,
    tamano_archivo_bytes: n(f.tamano_archivo_bytes),
    consumo_estimado: vacioANull(f.consumo_estimado),
    color_dominante: vacioANull(f.color_dominante),
    estilo: vacioANull(f.estilo),
    es_premium: f.es_premium,
    licencia: f.licencia.trim(),
    creditos: vacioANull(f.creditos),
  };
}

export function filaAForm(w: {
  slug: string; titulo: string; descripcion: string | null; categoria_id: string | null; etiquetas: string[] | null;
  tipo: Tipo; orientacion: Orientacion; duracion_s: number | string | null; resolucion: string | null;
  fps_recomendado: number | null; perfil_rendimiento: Perfil; tamano_archivo_bytes: number | string | null;
  consumo_estimado: string | null; color_dominante: string | null; estilo: string | null; es_premium: boolean;
  licencia: string; creditos: string | null;
}): FormWallpaper {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    slug: w.slug, titulo: w.titulo, descripcion: s(w.descripcion), categoria_id: s(w.categoria_id),
    etiquetas: (w.etiquetas ?? []).join(", "), tipo: w.tipo, orientacion: w.orientacion,
    duracion_s: s(w.duracion_s), resolucion: s(w.resolucion), fps_recomendado: s(w.fps_recomendado),
    perfil_rendimiento: w.perfil_rendimiento, tamano_archivo_bytes: s(w.tamano_archivo_bytes),
    consumo_estimado: s(w.consumo_estimado), color_dominante: s(w.color_dominante), estilo: s(w.estilo),
    es_premium: w.es_premium, licencia: s(w.licencia), creditos: s(w.creditos),
  };
}

// ── Estados ──
const TRANSICIONES: Record<Estado, Estado[]> = {
  borrador: ["revision", "archivado"],
  revision: ["borrador", "publicado", "archivado"],
  publicado: ["pausado", "archivado"],
  pausado: ["publicado", "revision", "archivado"],
  archivado: ["borrador"],
};
export function transicionesPermitidas(e: Estado): Estado[] {
  return TRANSICIONES[e];
}

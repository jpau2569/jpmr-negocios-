// Validación de archivos a subir. Espejo de claveSubida/MAX_BYTES de
// supabase/functions/_shared/acceso.ts: si allí cambia, cambia aquí.
import type { Calidad, Codec } from "./tipos";

export type TipoSubida = "video" | "preview" | "thumb" | "poster";
export const CALIDADES: Calidad[] = ["q720", "q1080", "q1440", "q2160"];
export const CODECS: Codec[] = ["h264", "hevc"];
export const MIME_PERMITIDOS: Record<string, string> = {
  "video/mp4": "mp4", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};
export const MAX_BYTES: Record<string, number> = {
  "video/mp4": 150 * 1024 * 1024,
  "image/jpeg": 5 * 1024 * 1024,
  "image/png": 5 * 1024 * 1024,
  "image/webp": 5 * 1024 * 1024,
};

export interface PeticionSubida {
  slug: string;
  tipo: TipoSubida;
  calidad?: string;
  codec?: string;
  mime: string;
  bytes: number;
}

/** Devuelve la clave de R2 o lanza Error con el mismo mensaje que el servidor. */
export function claveSubida(p: PeticionSubida): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || p.slug.length > 60) throw new Error("slug inválido");
  const ext = MIME_PERMITIDOS[p.mime];
  if (!ext) throw new Error("formato no permitido");
  if (!(p.bytes > 0 && p.bytes <= (MAX_BYTES[p.mime] ?? 0))) throw new Error("tamaño fuera de límite");
  if ((p.tipo === "video") !== (p.mime === "video/mp4")) throw new Error("tipo y formato no coinciden");
  if (p.tipo === "video") {
    if (!CALIDADES.includes(p.calidad as Calidad)) throw new Error("calidad inválida");
    if (!CODECS.includes((p.codec ?? "") as Codec)) throw new Error("códec inválido");
    return `videos/${p.slug}/${p.calidad}-${p.codec}.${ext}`;
  }
  return `imagenes/${p.slug}/${p.tipo}.${ext}`;
}

const MENSAJES: Record<string, string> = {
  "slug inválido": "El slug no es válido: guarda el wallpaper con un slug correcto antes de subir.",
  "formato no permitido": "Formato no permitido. Vídeo: MP4. Imagen: JPG, PNG o WebP.",
  "tamaño fuera de límite": "El archivo está vacío o supera el límite (vídeo 150 MB, imagen 5 MB).",
  "tipo y formato no coinciden": "El formato no corresponde al tipo de archivo (vídeo = MP4; imágenes = JPG/PNG/WebP).",
  "calidad inválida": "Elige una calidad válida.",
  "códec inválido": "Elige el códec del vídeo (H.264 o HEVC).",
};

/** Validación previa a pedir la URL firmada. */
export function validarArchivo(p: PeticionSubida): { ok: true; clave: string } | { ok: false; error: string } {
  try {
    return { ok: true, clave: claveSubida(p) };
  } catch (e) {
    const m = e instanceof Error ? e.message : "error";
    return { ok: false, error: MENSAJES[m] ?? m };
  }
}

/** Qué columna de wallpapers recibe cada tipo de imagen. */
export const COLUMNA_IMAGEN = { thumb: "url_thumbnail", poster: "url_poster", preview: "url_preview" } as const;

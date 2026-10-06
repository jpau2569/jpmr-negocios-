// Regla de «listo para publicar». La BD solo exige fecha_publicacion al publicar;
// el resto es política editorial del panel.
import type { Archivo } from "./tipos";
import { validarWallpaper, type FormWallpaper } from "./validacion";

export interface DatosPublicables {
  titulo: string;
  categoria_id: string | null;
  licencia: string;
  creditos: string | null;
  url_thumbnail: string | null;
  url_poster: string | null;
}

export const LICENCIA_PROPIA = "original-propia";

/** Lista de lo que falta; vacía = se puede publicar. */
export function faltaParaPublicar(w: DatosPublicables, archivos: Pick<Archivo, "id">[]): string[] {
  const falta: string[] = [];
  if (archivos.length < 1) falta.push("Al menos un archivo de vídeo");
  if (!w.url_thumbnail?.trim()) falta.push("Miniatura (thumbnail)");
  if (!w.url_poster?.trim()) falta.push("Póster");
  const largo = [...(w.titulo ?? "").trim()].length;
  if (largo < 3 || largo > 80) falta.push("Título (3-80 caracteres)");
  if (!w.categoria_id) falta.push("Categoría");
  const lic = (w.licencia ?? "").trim();
  if (!lic) falta.push("Licencia");
  else if (lic !== LICENCIA_PROPIA && !(w.creditos ?? "").trim()) falta.push("Créditos (la licencia no es «original-propia»)");
  return falta;
}

/** Fecha que se guarda al publicar: se conserva la que ya había (no reescribe la historia). */
export function fechaAlPublicar(actual: string | null, ahora: Date = new Date()): string {
  return actual && !Number.isNaN(Date.parse(actual)) ? actual : ahora.toISOString();
}

/** Para mostrar también los errores del formulario si los hubiera. */
export function erroresDeFormulario(f: FormWallpaper): string[] {
  return Object.values(validarWallpaper(f)).filter((x): x is string => Boolean(x));
}

// Reglas puras de acceso y validación. Sin red ni base de datos → testeables.

export type Calidad = 'q720' | 'q1080' | 'q1440' | 'q2160';
export const CALIDADES: Calidad[] = ['q720', 'q1080', 'q1440', 'q2160'];

export interface Archivo { calidad: Calidad; codec: 'h264' | 'hevc'; fps: number; storage_path: string; tamano_bytes: number }

/** Premium exige derecho verificado; gratis, solo estar publicado. Un despublicado no se sirve a nadie. */
export function puedeDescargar(w: { es_premium: boolean; estado_publicacion: string }, premiumUsuario: boolean): boolean {
  if (w.estado_publicacion !== 'publicado') return false;
  return !w.es_premium || premiumUsuario;
}

/** Mejor archivo ≤ calidad pedida; HEVC solo si el cliente lo declara soportado por hardware. */
export function elegirArchivo(archivos: Archivo[], calidadMax: Calidad, hevc: boolean, fpsMax = 60): Archivo | null {
  const tope = CALIDADES.indexOf(calidadMax);
  const ok = archivos.filter((a) => CALIDADES.indexOf(a.calidad) <= tope && a.fps <= fpsMax && (hevc || a.codec !== 'hevc'));
  if (!ok.length) return null;
  return ok.sort((a, b) => CALIDADES.indexOf(b.calidad) - CALIDADES.indexOf(a.calidad) || (a.codec === 'hevc' ? -1 : 1))[0];
}

// ── Subidas del panel ──
export const MIME_PERMITIDOS: Record<string, string> = { 'video/mp4': 'mp4', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_BYTES: Record<string, number> = { 'video/mp4': 150 * 1024 * 1024, 'image/jpeg': 5 * 1024 * 1024, 'image/png': 5 * 1024 * 1024, 'image/webp': 5 * 1024 * 1024 };

export function claveSubida(p: { slug: string; tipo: 'video' | 'preview' | 'thumb' | 'poster'; calidad?: string; mime: string; bytes: number }): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || p.slug.length > 60) throw new Error('slug inválido');
  const ext = MIME_PERMITIDOS[p.mime];
  if (!ext) throw new Error('formato no permitido');
  if (!(p.bytes > 0 && p.bytes <= MAX_BYTES[p.mime])) throw new Error('tamaño fuera de límite');
  if ((p.tipo === 'video') !== (p.mime === 'video/mp4')) throw new Error('tipo y formato no coinciden');
  if (p.tipo === 'video') {
    if (!CALIDADES.includes(p.calidad as Calidad)) throw new Error('calidad inválida');
    return `videos/${p.slug}/${p.calidad}.${ext}`;
  }
  return `imagenes/${p.slug}/${p.tipo}.${ext}`;
}

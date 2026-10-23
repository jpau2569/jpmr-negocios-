// Tipos de filas tal como las devuelve Supabase (solo lo que usa el panel).
export type Estado = "borrador" | "revision" | "publicado" | "pausado" | "archivado";
export const ESTADOS: Estado[] = ["borrador", "revision", "publicado", "pausado", "archivado"];
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  borrador: "Borrador",
  revision: "En revisión",
  publicado: "Publicado",
  pausado: "Pausado",
  archivado: "Archivado",
};

export type Tipo = "video" | "imagen" | "parallax" | "escena3d";
export type Orientacion = "vertical" | "horizontal" | "cuadrado";
export type Perfil = "ahorro" | "estandar" | "alta" | "ultra";
export type Calidad = "q720" | "q1080" | "q1440" | "q2160";
export type Codec = "h264" | "hevc";
export type Rol = "usuario" | "editor" | "admin";

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_portada: string | null;
  orden: number;
  activa: boolean;
}

export interface Wallpaper {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  categoria_id: string | null;
  etiquetas: string[];
  tipo: Tipo;
  orientacion: Orientacion;
  duracion_s: number | null;
  resolucion: string | null;
  fps_recomendado: number | null;
  perfil_rendimiento: Perfil;
  tamano_archivo_bytes: number | null;
  consumo_estimado: string | null;
  color_dominante: string | null;
  estilo: string | null;
  url_preview: string | null;
  url_thumbnail: string | null;
  url_poster: string | null;
  es_premium: boolean;
  destacado_orden: number | null;
  estado_publicacion: Estado;
  fecha_publicacion: string | null;
  licencia: string;
  creditos: string | null;
  updated_at: string;
}

export interface Archivo {
  id: string;
  wallpaper_id: string;
  calidad: Calidad;
  codec: Codec;
  fps: number;
  bitrate_kbps: number | null;
  tamano_bytes: number;
  storage_bucket: string;
  storage_path: string;
  sha256: string | null;
}
